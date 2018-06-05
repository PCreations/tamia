import { Subject, queueScheduler, merge } from 'rxjs';
import {
  startWith,
  scan,
  distinctUntilChanged,
  shareReplay,
  observeOn,
  pluck,
  subscribeOn
}
from 'rxjs/operators';
import { isEqual as _isEqual, slice as _slice } from 'lodash';

/**
 * A function to create a stream of a slice of the state, given a path as strings
 * @typedef {function} StateSelector
 * @param {...string} path - The string path to the desired value in the state, you way pass a custom compare function as a first argument, this function will be used to compare the previous state with the new one and must return "true" if you want to consider the two states equals
 * @example
 * // given a state shape : { foo: { bar: 'baz' } }, returns a stream of foo.bar value
 * select$('foo', 'bar')
 */

/**
 * A function use to update the state of the application, this function should remain pure, side-effects should be done in [Workflows]{@link Workflow}
 * @typedef {function} Updater
 * @param {object} state - the actual state of the application
 * @returns {object} newState - the new state of the application
 */

/**
 * A Rx.Observable that must emit [Updaters]{@link Updater}
 * @typedef {Rx.Observable} Workflow
 */

/**
 * A function to combine multiple [Workflows]{@link Workflow} together
 * @typedef {function} WorkflowsCombiner
 * @param {...Workflow} workflows - the workflows to combine together
 * @returns {Workflow} the combined workflow
 */

/**
 * A factory function to create an [Updater]{@link Updater} function
 * @typedef {function} UpdaterFactory
 * @param {function) updaterFn - an updater function that will receive the state as the last arguments. When more than one argument is given, a curried function is returned that accepts every arguments but the last (reserved for the state)
 * @returns {Updater} the updater function
 * @example
 * const state = createState({ foo: { bar: 42 }, foobaz: 'baz' });
 *
 * const updateFooBarAndFoobaz = state.createUpdater((foobar, foobaz, state) => ({
 *  ...state,
 *  foo: { bar: foobar },
 *  foobaz,
 * }));
 *
 * //updateFoobaz('foo', '43');
 */


/**
 * @typedef {Object} State
 * @property {Rx.Subject} $ - The state of the application as a Rxjs hot stream. When subscribed, the last state is returned
 * @property {StateSelector} select$
 * @property {Object} value - The actual value of the application's state
 * @property {WorkflowsCombiner} combineWorkflows
 * @property {UpdaterFactory} createUpdater
 */

/**
 * Creates a State object
 *
 * @param {object} initialState - The initial state of the application
 * @returns {State}
 * @example
 * const initialState = { foo: { bar: 42 }, foobaz: 'baz' };
 *
 * const state = createState(initialState);
 *
 * const updateBar = value => state => ({
 *   ...state,
 *   foo: {
 *     bar: value,
 *   }
 * });
 *
 * const updateFooBaz = state.createUpdater((value, state) => ({
 *   ...state,
 *   foobaz: value,
 * });
 *
 * const editBarEverySecDuring10sec$ = timer(0, 1000).pipe(
 *  take(10),
 *  map(timer => updateBar(timer)) // we can't just to map to updateBar because map will pass 2 arguments to the updateBar function thus conflicting with the last expected argument "state"
 * );
 *
 * const editFoobazWhenBarIsOdd$ = state.select$('foo', 'bar').pipe(
 *   filter(bar => bar % 2 === 1),
 *   map(bar => updateFooBaz(`baz${bar}`))
 * )
 *
 *
 * const run = () => state.combineWorkflows(
 *   editBarEverySec$,
 *   editFoobazWhenBarIsOdd$,
 * );
 *
 * state.select$('foobaz').subscribe(console.log);
 *
 * run();
 * // will output : baz1, baz3, baz5, baz7, baz9
 */
const createState = (initialState, onError = console.error.bind(console)) => {
  let value;

  const updates$ = new Subject().pipe(subscribeOn(queueScheduler));

  const $ = updates$.pipe(
    startWith(initialState),
    scan((state, updater) => {
      const newState = updater(state);
      updater.$.next(newState);
      return newState;
    }),
    distinctUntilChanged(_isEqual),
    shareReplay(1),
  );

  $.subscribe(
    (state) => { value = state; },
    onError,
  );

  const createUpdater = (updateFn) => {
    const updateFnSubject = new Subject().pipe(shareReplay(1));
    if (updateFn.length === 1) {
      updateFn.$ = updateFnSubject;
      return updateFn;
    }
    else if (updateFn.length > 1) {
      const _updateFn = (...args) => {
        const preAppliedArgs = args.length > 1 ? _slice(args, 0, args.length - 1) : args;
        const returnedFn = state => updateFn(...preAppliedArgs, state);
        returnedFn.$ = updateFnSubject;
        return returnedFn;
      };
      _updateFn.$ = updateFnSubject;
      return _updateFn;
    }
    throw new Error('missing argument state in updater function');
  };

  const select$ = (...path) => {
    const [statePath, compare] =
    typeof path[0] === typeof (() => {}) ? [_slice(path, 1), path[0]] : [path, _isEqual];

    return $.pipe(
      pluck(...statePath),
      distinctUntilChanged(compare)
    );
  };

  const combineWorkflows = (...workflows) =>
    merge(...workflows).pipe(observeOn(queueScheduler))
    .subscribe(updates$);

  return {
    $,
    select$,
    get value() {
      return value;
    },
    combineWorkflows,
    createUpdater,
  };
};

export default createState;
