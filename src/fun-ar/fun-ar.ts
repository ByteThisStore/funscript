import { ArFilterAsyncCallback, ArFindAsyncCallback, ArFindIndexAsyncCallback, ArForEachAsyncCallback, ArMapAsyncCallback, ArReduceAsyncCallback, iFunAr } from "../models/fun-ar";

const findIndexSeq = async <T>(input: T[], callback: ArFindIndexAsyncCallback<T>, thisArg?: any): Promise<number> => {
    let elementIndex: number = -1;
    let found = false;
    for (let i = 0; elementIndex === -1 && i < input.length; i++) {
        if (typeof thisArg !== 'undefined') {
            found = await callback.bind(thisArg, input[i], i, input)();
        } else {
            found = await callback(input[i], i, input);
        }
        if (found) {
            elementIndex = i;
        }
    }
    return elementIndex;
};

/**
 * Object which will hold async versions of array methods
 */
export const FunAr: iFunAr = {
    async: {
        seq: {
            /**
             * Run a forEach asynchronously where each callback is not invoked until the previous one finished
             * @param input 
             * @param callback 
             * @param thisArg 
             * @returns Promise<void>
             */
            forEach: async <T>(input: T[], callback: ArForEachAsyncCallback<T>, thisArg?: any): Promise<void> => {
                return input.reduce((promise, item, index) => {
                    return promise.then(() => {
                        if (typeof thisArg !== 'undefined') {
                            return promise.then(callback.bind(thisArg, item, index, input));
                        } else {
                            return promise.then(() => callback(item, index, input))
                        }
                    });
                }, Promise.resolve());
            },
            findIndex: findIndexSeq,
            /**
             * Find an item using an asynchronous callback, returns a promise of the first found item or undefined
             * @param input 
             * @param callback 
             * @param thisArg 
             * @returns Promise<T | undefined>
             */
            find: async <T>(input: T[], callback: ArFindAsyncCallback<T>, thisArg?: any): Promise<T | undefined> => {
                const index = await findIndexSeq(input, callback, thisArg);
                return index === -1 ? undefined : input[index];
            },
            /**
             * Asynchronously map the input of an array to a new array, running each callback one after another
             * @param input 
             * @param callback 
             * @param thisArg 
             * @returns Promise<T[]>
             */
            map: async <T>(input: T[], callback: ArMapAsyncCallback<T>, thisArg?: any): Promise<T[]> => {

                const onResponse = (partialList: T[], itemResult: T) => [...partialList, itemResult];

                return input.reduce((promise, item, index) => {
                    return promise.then((partialList: T[]) => {
                        if (typeof thisArg !== 'undefined') {
                            return promise.then(callback.bind(thisArg, item, index, input)).then(itemResult => onResponse(partialList, itemResult));
                        } else {
                            return promise.then(() => callback(item, index, input)).then(itemResult => onResponse(partialList, itemResult));
                        }
                    });
                }, Promise.resolve([] as T[]));
            },
            /**
             * Asynchronously filter the input of an array to a new array, running each callback one after another
             * @param input 
             * @param callback 
             * @param thisArg 
             * @returns Promise<T[]>
             */
            filter: async <T>(input: T[], callback: ArFilterAsyncCallback<T>, thisArg?: any): Promise<T[]> => {
                const onResponse = (partialList: T[], item: T, doInclude: boolean) => !doInclude ? partialList : [...partialList, item];

                return input.reduce((promise, item, index) => {
                    return promise.then((partialList: T[]) => {
                        if (thisArg) {
                            return promise.then(callback.bind(thisArg, item, index, input)).then(doInclude => onResponse(partialList, item, doInclude));
                        } else {
                            return promise.then(() => callback(item, index, input)).then(doInclude => onResponse(partialList, item, doInclude));
                        }
                    });
                }, Promise.resolve([] as T[]));
            },
            /**
             * Reduce an array asynchronously, invoking each callback sequentially
             * @param input 
             * @param callback 
             * @param initialValue 
             * @returns Promise<A>
             */
            reduce: async <T, A>(input: T[], callback: ArReduceAsyncCallback<T, A>, initialValue?: A): Promise<A> => {
                const fullInput = typeof initialValue === 'undefined' ? input.slice(1) : input;
                const firstValue = typeof initialValue === 'undefined' ? input[0] : initialValue;
                const indexOffset = typeof initialValue === 'undefined' ? 1 : 0;

                return fullInput.reduce((promise, item, index) => {
                    return promise.then(acc => callback(acc as A, item, index + indexOffset))
                }, Promise.resolve(firstValue as T | A)) as Promise<A>;
            }
        },
        parallel: {
            /**
             * Run a forEach asynchronously where each callback is invoked immediately
             * @param input 
             * @param callback 
             * @param thisArg 
             * @returns Promise<void>
             */
            forEach: async <T>(input: T[], callback: ArForEachAsyncCallback<T>, thisArg?: any): Promise<void> => {
                return Promise.all(input.reduce((promises, item, index) => {
                    if (typeof thisArg !== 'undefined') {
                        return [...promises, callback.bind(thisArg)(item, index, input)];
                    } else {
                        return [...promises, callback(item, index, input)];
                    }
                }, [] as Promise<any>[])).then(() => void 0);
            },
            /**
             * Asynchronously map the input of an array to a new array, running each callback in parallel
             * @param input 
             * @param callback 
             * @param thisArg 
             * @returns Promise<T[]>
             */
            map: async <T>(input: T[], callback: ArMapAsyncCallback<T>, thisArg?: any): Promise<T[]> => {
                const newAr: T[] = new Array<T>(input.length);
                const promises: Promise<any>[] = [];

                input.forEach((item, index) => {
                    if (typeof thisArg !== 'undefined') {
                        promises.push((async () => {
                            const response = await callback.bind(thisArg, item, index, input)();
                            newAr[index] = response;
                        })());
                    } else {
                        promises.push((async () => {
                            const response = await callback(item, index, input);
                            newAr[index] = response;
                        })());
                    }
                });

                return Promise.all(promises).then(() => newAr);
            },
            /**
             * Asynchronously filter the input of an array to a new array, running each callback in parallel
             * @param input 
             * @param callback 
             * @param thisArg 
             * @returns Promise<T[]>
             */
            filter: async <T>(input: T[], callback: ArFilterAsyncCallback<T>, thisArg?: any): Promise<T[]> => {
                const filterResults: number[] = [];
                const promises: Promise<any>[] = [];

                input.forEach((item, index) => {
                    if (typeof thisArg !== 'undefined') {
                        promises.push((async () => {
                            const response = await callback.bind(thisArg, item, index, input)();
                            if (response) {
                                filterResults.push(index);
                            }
                        })());
                    } else {
                        promises.push((async () => {
                            const response = await callback(item, index, input);
                            if (response) {
                                filterResults.push(index);
                            }
                        })());
                    }
                });

                await Promise.all(promises);
                return filterResults.sort().map(inputIndex => input[inputIndex]);
            }
        }
    }
}