import EventEmitter from "events";
import { Memoize } from "./memoize";
import { MemoizeMethod } from "./memoize-decorator";

describe("Memoize", () => {
    it("should memoize in basic scenario", () => {
        let hitCount = 0;
        const input = 12;
        const map = (input: number) => input * 2;
        const calc = (input: number) => {
            hitCount++;
            return map(input);
        };

        let expected = map(input);
        let actual;

        const memoized = Memoize(calc);
        actual = memoized(input);
        actual = memoized(input);
        actual = memoized(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);
    });

    it("should memoize multiple inputs seperately", () => {
        let hitCount = 0;
        const inputs = [12, 13, 15];
        const map = (input: number) => input * 2;
        const calc = (input: number) => {
            hitCount++;
            return map(input);
        };

        let expected = inputs.map(map);
        let actual: any = [null, null, null];

        const memoized = Memoize(calc);
        actual[0] = memoized(inputs[0]);
        actual[0] = memoized(inputs[0]);
        actual[0] = memoized(inputs[0]);

        actual[1] = memoized(inputs[1]);
        actual[1] = memoized(inputs[1]);
        actual[1] = memoized(inputs[1]);

        actual[2] = memoized(inputs[2]);
        actual[2] = memoized(inputs[2]);
        actual[2] = memoized(inputs[2]);

        expect(hitCount).toBe(3);
        expect(actual).toEqual(expected);
    });

    it("should expire in cache based on specifications", async () => {
        let hitCount = 0;

        const expiration = 100;

        const input = 12;
        const map = (input: number) => input * 2;
        const calc = (input: number) => {
            hitCount++;
            return map(input);
        };

        let expected = map(input);
        let actual;

        const memoized = Memoize(calc, {
            cacheExpiration: {
                evaluate: () => expiration,
                type: "relative",
            },
        });
        actual = memoized(input);
        actual = memoized(input);
        actual = memoized(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);

        await new Promise((r) => setTimeout(r, expiration * 2));

        actual = memoized(input);

        expect(hitCount).toBe(2);
        expect(actual).toBe(expected);
    }, 1000);

    it("should memoize class method with decorator", () => {
        let hitCount = 0;
        const input = 123;

        const map = (input: number) => input * 2;
        class MemoizeTest {
            @MemoizeMethod()
            calc(input: number) {
                hitCount++;
                return map(input);
            }
        }

        const tester = new MemoizeTest();

        let expected = map(input);
        let actual;

        actual = tester.calc(input);
        actual = tester.calc(input);
        actual = tester.calc(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);
    });

    it("should memoize and keep 'this' reference in place", () => {
        let hitCount = 0;

        const map = (input: number) => input * 2;
        const input = 123;
        class TestClass {
            calc(input: number) {
                hitCount++;
                return this.map(input);
            }

            private map(input: number) {
                return map(input);
            }
        }

        const tester = new TestClass();
        const memoizedCalc = Memoize(tester.calc.bind(tester));

        let expected = map(input);
        let actual;

        actual = memoizedCalc(input);
        actual = memoizedCalc(input);
        actual = memoizedCalc(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);
    });

    it("should memoize and keep 'this' reference in place for decorator", () => {
        let hitCount = 0;

        const map = (input: number) => input * 2;
        const input = 123;
        class TestClass {
            @MemoizeMethod()
            calc(input: number) {
                hitCount++;
                return this.map(input);
            }

            private map(input: number) {
                return map(input);
            }
        }

        const tester = new TestClass();

        let expected = map(input);
        let actual;

        actual = tester.calc(input);
        actual = tester.calc(input);
        actual = tester.calc(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);
    });

    it("should memoize and keep 'this' reference in place for decorator with options specified", () => {
        let hitCount = 0;

        const offset = 18;
        const map = (input: number) => input * 2;
        const input = 123;
        class TestClass {

            constructor(
                private offset: number
            ) {}

            @MemoizeMethod({
                cacheExpiration: {
                    evaluate: () => 1000,
                    type: "relative",
                },
            })
            calc(input: number) {
                hitCount++;
                return this.map(input);
            }

            private map(input: number) {
                return map(input) + this.offset;
            }
        }

        const tester = new TestClass(offset);

        let expected = map(input) + offset;
        let actual;

        actual = tester.calc(input);
        actual = tester.calc(input);
        actual = tester.calc(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);
    }, 200);

    it("should expire cache with promise based expiration", async () => {

        const eventEmitter = new EventEmitter();

        const promiseExpire = () => {
            return new Promise<void>(resolve => {
                eventEmitter.addListener('invalidate', () => {
                    resolve();
                });
            });
        }
        let hitCount = 0;

        const input = 12;
        const map = (input: number) => input * 2;
        const calc = (input: number) => {
            hitCount++;
            return map(input);
        };

        let expected = map(input);
        let actual;

        const memoized = Memoize(calc, {
            cacheExpiration: {
                evaluate: promiseExpire,
                type: "promise-resolution",
            },
        });
        actual = memoized(input);
        actual = memoized(input);
        actual = memoized(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);

        eventEmitter.emit("invalidate");
        await new Promise(r => setImmediate(r));

        actual = memoized(input);

        expect(hitCount).toBe(2);
        expect(actual).toBe(expected);
        

    }, 200);

    it("should expire based on promise multiple times", async () => {
        const eventEmitter = new EventEmitter();

        const promiseExpire = () => {
            return new Promise<void>(resolve => {
                eventEmitter.addListener('invalidate', () => {
                    resolve();
                });
            });
        }
        let hitCount = 0;

        const input = 12;
        const map = (input: number) => input * 2;
        const calc = (input: number) => {
            hitCount++;
            return map(input);
        };

        let expected = map(input);
        let actual;

        const memoized = Memoize(calc, {
            cacheExpiration: {
                evaluate: promiseExpire,
                type: "promise-resolution",
            },
        });
        actual = memoized(input);
        actual = memoized(input);
        actual = memoized(input);

        expect(hitCount).toBe(1);
        expect(actual).toBe(expected);

        eventEmitter.emit("invalidate");
        await new Promise(r => setImmediate(r));

        actual = memoized(input);

        eventEmitter.emit("invalidate");
        await new Promise(r => setImmediate(r));

        actual = memoized(input);

        expect(hitCount).toBe(3);
        expect(actual).toBe(expected);
    }, 200);
});
