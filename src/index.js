import { Subject, queueScheduler, merge } from 'rxjs';
import {
  startWith,
  scan,
  distinctUntilChanged,
  share,
  shareReplay,
  observeOn,
  pluck,
  filter,
  map,
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
 * A function to dispatch [Updater]{@link Updater} or react to updater being dispatched
 * @typedef {function} UpdateDispatcher
 * @param {function} Updater
 * @property {function} $ - A function accepting an updater name (its function.name) as argument and returning a stream of its resultint state updates
 * @example
 * const store = createState({ baz: null, foo: null });
 *
 * const updateBaz = state => ({
 *   ...state,
 *   baz: 42
 * });
 *
 * const updateFoo = foo => function updateFoo(state) {
 *   return {
 *     ...state,
 *     foo,
 *   };
 * };
 *
 * state.update.$('updateFoo').subscribe(nextState => console.log('updateFoo has been dispatched, next state is', nextState));
 * );
 *
 * state.update.$('updateBaz').subscribe(nextState => console.log('updateBaz has been dispatched, next state is', nextState));
 * );
 *
 * state.update(updateBaz);
 * state.update(updateFoo('new foo'));
 */

/**
 * @typedef {Object} State
 * @property {Rx.Subject} $ - The state of the application as a Rxjs hot stream. When subscribed, the last state is returned
 * @property {StateSelector} select$
 * @property {Object} value - The actual value of the application's state
 * @property {WorkflowsCombiner} combineWorkflows
 * @property {UpdateDispatcher} update
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
 * const updateFooBaz = (value) => function updateFooBaz(state) = {
 *   return {
 *     ...state,
 *     foobaz: value,
 *   };
 * };
 *
 * const editBarEverySecDuring10sec$ = timer(0, 1000).pipe(
 *  take(10),
 *  map(updateBar)
 * );
 *
 * const editFoobazWhenBarIsOdd$ = state.update.$('updateBar').pipe(
 *   filter(({ foo: { bar } }) => bar % 2 === 1),
 *   map(({ foo: { bar } }) => updateFooBaz(`baz${bar}`))
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

  const update = updates$.next.bind(updates$);

  const _updaters = new Subject().pipe(
    share(),
    subscribeOn(queueScheduler)
  );

  update.$ = updaterName => _updaters.pipe(
    filter(({ name, newState }) => updaterName === name),
    map(({ name, newState }) => newState),
  );

  const $ = updates$.pipe(
    startWith(initialState),
    scan((state, updater) => {
      const newState = updater(state);
      if (updater.name) {
        _updaters.next({ name: updater.name, newState });
      }
      return newState;
    }),
    distinctUntilChanged(_isEqual),
    shareReplay(1),
  );

  $.subscribe(
    (state) => { value = state; },
    onError,
  );

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
    update,
  };
};

export default createState;
