let stack = [];
let sum = 0;
const operations = ["5","-2","4","C","D","9","+","+"];

for (let i = 0; i < operations.length; i++) {
    console.log("OPERATIONS[i]: ", operations[i]);

    if (!isNaN(operations[i])) {
        stack.push(operations[i] - '0');
    }

    else if (operations[i] === 'C') stack.pop();

    else if (operations[i] === 'D') {
        const a = stack.pop();
        stack.push(a);
        stack.push(a * 2);
    }

    else if (operations[i] === '+') {
        const a = stack.pop();
        const b = stack.pop();
        stack.push(b);
        stack.push(a);
        stack.push(a + b);
    }
    console.log("STACK: ", stack);
}

for (let e of stack) sum += e;
console.log("SUM: ", sum);
