const STATES = {
    CLOSED: "CLOSED",
    OPEN: "OPEN",
    HALF_OPEN: "HALF_OPEN",
};

class CircuitBreaker {
    /**
     * @param {object} opts
     * @param {number} opts.failureThreshold  - consecutive failures before opening
     * @param {number} opts.recoveryTimeout   - ms to wait before probing (OPEN → HALF_OPEN)
     * @param {string} opts.serviceKey        - identifier used in log messages
     */
    constructor({ failureThreshold = 3, recoveryTimeout = 30000, serviceKey = "unknown" } = {}) {
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.serviceKey = serviceKey;
        this.nextProbeAt = null;
    }

    /**
     * Returns true when the breaker is OPEN and the recovery window has not yet elapsed.
     * As a side-effect, transitions OPEN → HALF_OPEN when the window expires.
     */
    isOpen() {
        if (this.state === STATES.OPEN) {
            if (Date.now() >= this.nextProbeAt) {
                this.state = STATES.HALF_OPEN;
                console.log(`[CIRCUIT] ${this.serviceKey}: OPEN → HALF_OPEN (probing)`);
                return false;
            }
            return true;
        }
        return false;
    }

    onSuccess() {
        if (this.state === STATES.HALF_OPEN) {
            console.log(`[CIRCUIT] ${this.serviceKey}: HALF_OPEN → CLOSED (probe succeeded)`);
        }
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.nextProbeAt = null;
    }

    onFailure() {
        this.failureCount++;

        if (this.state === STATES.HALF_OPEN) {
            // Probe failed — go back to OPEN and reset the recovery timer.
            this.state = STATES.OPEN;
            this.nextProbeAt = Date.now() + this.recoveryTimeout;
            console.warn(
                `[CIRCUIT] ${this.serviceKey}: HALF_OPEN → OPEN (probe failed, next probe in ${this.recoveryTimeout / 1000}s)`
            );
            return;
        }

        if (this.failureCount >= this.failureThreshold) {
            this.state = STATES.OPEN;
            this.nextProbeAt = Date.now() + this.recoveryTimeout;
            console.warn(
                `[CIRCUIT] ${this.serviceKey}: CLOSED → OPEN after ${this.failureCount} failures (next probe in ${this.recoveryTimeout / 1000}s)`
            );
        }
    }

    get currentState() {
        return this.state;
    }
}

export { CircuitBreaker, STATES };
