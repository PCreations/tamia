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
      describe('when the updateBaz updater is emitted by the workflow', () => {
        test('then the updateFooBarWhenBazIsOdd$ should receive the future state and emits updateFoobar updater function if baz is odd', (done) => {
          const state = createState({ foo: { bar: "foobar" }, baz: 42 },
            done.fail.bind(done),
          );
          const updateBaz = (value) => function updateBaz(state) {
            return {
              ...state,
              baz: value,
            };
          };

          const updateFoobar = (value) => function updateFoobar(state) {
            return {
              ...state,
              foo: {
                bar: value,
              }
            };
          };

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
            state.updaters('updateBaz').pipe(
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
        const updateBaz = (value) => (state) => ({
          ...state,
          baz: value,
        });
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
