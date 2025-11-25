// Example file with various code issues for testing

// Security issue fixed: removed eval usage and added comprehensive input validation
function processUserInput(input) {
  // Input validation: check type, length, and format
  if (typeof input !== 'string') {
    console.error('Invalid input: must be a string');
    return null;
  }
  
  // Validate length to prevent DoS attacks
  const MAX_INPUT_LENGTH = 10000;
  if (input.length === 0) {
    console.error('Invalid input: empty string');
    return null;
  }
  if (input.length > MAX_INPUT_LENGTH) {
    console.error(`Invalid input: exceeds maximum length of ${MAX_INPUT_LENGTH} characters`);
    return null;
  }
  
  // Sanitize input: trim whitespace
  const sanitizedInput = input.trim();
  
  // Safe alternative: parse JSON if that's the intent
  try {
    const parsed = JSON.parse(sanitizedInput);
    
    // Additional validation: ensure parsed result is an object or array
    if (parsed === null || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
      console.error('Invalid input: parsed value must be an object or array');
      return null;
    }
    
    // Optional: validate against a schema (example structure)
    // For production, use joi, zod, or ajv for comprehensive validation
    // Example with basic validation:
    // if (!isValidSchema(parsed)) {
    //   console.error('Invalid input: does not match expected schema');
    //   return null;
    // }
    
    return parsed;
  } catch (error) {
    console.error('Invalid input format:', error.message);
    return null;
  }
  // If dynamic functionality is needed, use object mapping:
  // const allowedActions = {
  //   'action1': () => { /* safe code */ },
  //   'action2': () => { /* safe code */ }
  // };
  // return allowedActions[input]?.() || null;
}

// Security issue fixed: moved credentials to environment variables
const apiKey = process.env.API_KEY;
const password = process.env.PASSWORD;

// Best practice issue: var instead of let/const
var counter = 0;
var userName = "John";

// Code quality: console.log
function debugFunction() {
  console.log("Debug information");
  console.log("More debug info");
}

// Code quality: debugger statement
function problematicFunction() {
  debugger;
  return true;
}

// Placeholder function for demonstration purposes
function riskyOperation() {
  // This is a placeholder function for error handling demonstration
  throw new Error("Simulated risky operation failure");
}

// Error handling: proper error logging and handling
try {
  riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // Optionally rethrow if this error should propagate:
  // throw error;
}

// TypeScript: any type
function processData(data: any): any {
  return data;
}

// TODO comment
// TODO: Refactor this function
function needsWork() {
  return "incomplete";
}

// Good practices example
const goodFunction = () => {
  const message = "This is good code";
  return message;
};

export { processUserInput, debugFunction, goodFunction };