import { range } from 'rxjs';
import {
  take,
  map,
  skip,
  filter,
  tap,
}
from 'rxjs/operators';
import createState from '../index';

describe('given the createUpdater function', () => {
  describe('when given two arguments', () => {
    test('then returns a curried function', () => {
      const state = createState();
      const updater = state.createUpdater((value, state) => {
        return ({
          ...state,
          value,
        });
      });

      expect(updater(42)({ foo: 'bar' })).toEqual({
        foo: 'bar',
        value: 42,
      });
    });
    test('then returns a function exposing a stream of the resulting state', (done) => {
      const state = createState({ foo: 'bar' }, done.fail.bind(done));
      const updater = state.createUpdater((value, state) => ({
        ...state,
        value,
      }));
      updater.$.pipe(
        take(2),
        map((nextState, i) => {
          if (i === 0) {
            expect(nextState).toEqual({
              foo: 'bar',
              value: 42,
            });
          }
          else {
            expect(nextState).toEqual({
              foo: 'bar',
              value: 17,
            });
          }
        })
      ).subscribe({
        complete: done,
        error: done.fail.bind(done),
      });

      state.combineWorkflows(
        range(0, 2).pipe(map(i => updater(i === 0 ? 42 : 17)))
      );
    });
  });
  describe('when given one argument', () => {
    test('then should execute the function normally', () => {
      const state = createState();
      const updater = state.createUpdater(state => {
        return ({
          ...state,
          value: 42,
        });
      });

      expect(updater({ foo: 'bar' })).toEqual({
        foo: 'bar',
        value: 42,
      });
    });
  });
});
describe('given a state with { foo: { bar: "foobar" }, baz: 42 } as initial state', () => {
  describe('when calling state.value', () => {
    test('then the initial state should be returned', (done) => {
      const state = createState({ foo: { bar: "foobar" }, baz: 42 },
        done.fail.bind(done),
      );
      expect(state.value).toEqual({ foo: { bar: "foobar" }, baz: 42 });
      done();
    });
  });
  describe('given a selector of foo.bar : select$("foo", "bar")', () => {
    describe('when subscribing to the selector', () => {
      test('then the initial state foo.bar should be returned', done => {
        const state = createState({ foo: { bar: "foobar" }, baz: 42 },
          done.fail.bind(done),
        );
        state.select$('foo', 'bar').pipe(
          take(1),
          tap(foobar => {
            expect(foobar).toEqual("foobar");
          })
        ).subscribe({
          complete: done,
          error: done.fail.bind(done),
        });
      });
    });
  });
  describe('given a stream emitting 5 numbers from 0 to 4 and mapping this number to an updateBaz updater function', () => {
    describe('given an updateFoobar updater function and a updateFooBarWhenBazIsOdd$ stream combined as workflows', () => {
      describe('when the updateFoobar function emits', () => {
        test('then the updateFooBarWhenBazIsOdd$ should receive the future state and emits updateFoobar updater function if baz is odd', (done) => {
          const state = createState({ foo: { bar: "foobar" }, baz: 42 },
            done.fail.bind(done),
          );
          const updateBaz = state.createUpdater(function updateBaz(value, state) {
            return ({
              ...state,
              baz: value,
            });
          });
          const updateFoobar = state.createUpdater(function updateFoobar(value, state) {
            return {
              ...state,
              foo: {
                bar: value,
              }
            };
          });
          state.select$('foo', 'bar').pipe(
            skip(1), //skipping initial value
            take(2),
            map((v, i) => {
              if (i === 0) {
                expect(v).toEqual('foobar1');
              }
              else {
                expect(v).toEqual('foobar3');
              }
            })
          ).subscribe({
            complete: done,
            error: done.fail.bind(done),
          });

          state.combineWorkflows(
            updateBaz.$.pipe(
              filter(nextState => nextState.baz % 2 === 1),
              map(nextState => updateFoobar(`foobar${nextState.baz}`))
            ),
            range(0, 5).pipe(map(updateBaz)),
          );
        });
      });
    });
    describe('when combined as workflow', () => {
      test('then the value of "baz" should change 5 times from 0 to 4', (done) => {
        const state = createState({ foo: { bar: "foobar" }, baz: 42 },
          done.fail.bind(done),
        );
        const updateBaz = state.createUpdater((value, state) => ({
          ...state,
          baz: value,
        }));
        state.select$('baz').pipe(
          skip(1), //skipping initial value
          take(5),
          map((v, i) => {
            expect(v).toEqual(i);
          })
        ).subscribe({
          complete: done,
          error: done.fail.bind(done),
        });
        state.combineWorkflows(
          range(0, 4).pipe(map(updateBaz)),
        );
      });
    });
  });
});
