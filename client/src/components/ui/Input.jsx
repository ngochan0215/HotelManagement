function Input(props) {
  return (
    <input
      {...props}
      className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

export default Input;
