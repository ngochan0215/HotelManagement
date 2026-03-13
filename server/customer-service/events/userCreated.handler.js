export const userCreatedHandler = (customerService) => {
    return async(data) => {
        console.log("Handling USER_CREATED");
        await customerService.createCustomer(data);
    }
}