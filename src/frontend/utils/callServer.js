export default function callServer(method, ...args) {
  return new Promise((resolve, reject) => {
    return google.script.run
    .withSuccessHandler(resolve)
    .withFailureHandler(reject)[method](...args);
  })
};