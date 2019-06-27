import Reflux from "reflux";
import Q from 'q';

const WelcomeActions = Reflux.createActions([
    {'flashSearchBox': {asyncResult: true}}
]);

console.log(WelcomeActions);

WelcomeActions.flashSearchBox.listen(function (delayMs = 500) {
  const deferred = Q.defer();
  setTimeout(()=>deferred.resolve("finish"), delayMs);
  deferred.promise.then(this.completed);
  return "start";
});

export default WelcomeActions;