const nums = [-3,-2,-1,0,0,1,2];
let lower = 0;
let higher = nums.length - 1;
let pos = 0, neg = 0;

while (lower <= higher) {
    if (nums[lower] < 0) {
        neg++;
        lower++;
        console.log("NUMS[LOWER]: ", nums[lower]);
        console.log("NEG: " + neg + " - LOWER: " + lower);
    }
    if (nums[higher] > 0) {
        pos++;
        higher--;
        console.log("NUMS[HIGHER]: ", nums[higher]);
        console.log("POS: " + pos + " - HIGHER: " + higher);
    } 
    if (nums[lower] === 0 || nums[higher] === 0) break;
}   
console.log("POS: " + pos + " - NEG: " + neg);
