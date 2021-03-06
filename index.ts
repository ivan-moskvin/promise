type Handler = {
    onFullfill: (val: unknown) => void;
    onReject: (val: unknown) => void;
}

const STATUSES: { [key: string]: string } = {
    PENDING: 'PENDING',
    FULFILLED: 'FULFILLED',
    REJECTED: 'REJECTED'
}

class Future {
    status: keyof typeof STATUSES;
    value: unknown;
    handlers: Handler[];

    static all(futuresArr: Future[]) {
        return new Future((res, rej) => {
            const results = [];
            futuresArr.forEach((future) => {
                future.then((value) => {
                    results.push(value);

                    // Resolve array of results only when all values resolved
                    if (results.length === futuresArr.length) {
                        res(results);
                    }
                    // Reject on first error
                }).catch(err => rej(err))
            })
        })
    }

    static race(futuresArr: Future[]) {
        return new Future((res, rej) => {
            futuresArr.forEach((future) => {
                future.then((value) => {
                    // Resolve fastest one immediately
                    res(value);
                }).catch(err => rej(err))
            })
        })
    }

    constructor(resolver) {
        this.status = STATUSES.PENDING;
        this.value = undefined;
        this.handlers = [];

        try {
            resolver(this.resolve, this.reject);
        } catch (err) {
            this.reject(err);
        }
    }

    resolve = (value) => {
        this.updateResult(value, STATUSES.FULFILLED);
    }

    reject = (error) => {
        this.updateResult(error, STATUSES.REJECTED)
    }

    isThenable = (val) => {
        return val instanceof Future;
    }

    /**
     * Update result of current promise
     * @param value
     * @param status
     */
    updateResult(value, status) {
        // Async
        setTimeout(() => {
            // If promise is already resolved - do nothing
            if (this.status !== STATUSES.PENDING) {
                return;
            }

            // If object has THEN method chain it further
            if (this.isThenable(value)) {
                return value.then(this.resolve, this.reject);
            }

            // Set values
            this.value = value;
            this.status = status;

            // Execute handlers
            this.executeHandlers();
        }, 0);
    }

    /**
     * Adding handler
     * @param handler
     */
    addHandler(handler: Handler) {
        this.handlers.push(handler);
        this.executeHandlers();
    }

    /**
     * Execute all handlers
     */
    executeHandlers() {
        // Do nothing while pending.
        if (this.status === STATUSES.PENDING) {
            return null;
        }

        // If promise resolved we can start to process handlers
        this.handlers.forEach(handler => {
            // If fulfilled - call onSuccess callback
            if (this.status === STATUSES.FULFILLED) {
                return handler.onFullfill(this.value);
            }

            // Otherwise call onReject
            return handler.onReject(this.value);
        })

        this.handlers = [];
    }

    /**
     * Then
     * @param onFulfill
     * @param onReject
     */
    then(onFulfill?, onReject?) {
        return new Future((res, rej) => {
            this.addHandler({
                onFullfill: (value) => {
                    if (!onFulfill) {
                        return res(value);
                    }

                    try {
                        return res(onFulfill(value));
                    } catch (err) {
                        return rej(err);
                    }
                },
                onReject: (value) => {
                    if (!onReject) {
                        rej(value);
                    }

                    try {
                        return rej(onReject(value));
                    } catch (err) {
                        return rej(err);
                    }
                }
            })
        })
    }

    /**
     * Catch
     * @param onReject
     */
    catch(onReject) {
        return this.then(null, onReject);
    }
}

// Some testing
let promise1 = new Future((resolve) => {
    setTimeout(() => resolve('done'), 1000);
});
let promise2 = new Future((resolve) => {
    setTimeout(() => resolve('done2'), 1000);
});
let promise3 = new Future((resolve, reject) => {
    setTimeout(() => reject('reject1'), 1000);
});
let promise4 = new Future((resolve) => {
    setTimeout(() => resolve('racing fast done'), 500);
});
let promise5 = new Future((resolve) => {
    setTimeout(() => resolve('racing long done'), 1000);
});

Future.all([promise1, promise2]).then(([res1, res2]) => {
    console.log(res1);
    console.log(res2);
}).catch(err => {
    console.log(err)
})

Future.all([promise1, promise2, promise3]).then(([res1, res2]) => {
    console.log(res1);
    console.log(res2);
}).catch(err => {
    console.log(err)
})

Future.race([promise5, promise4]).then((res) => {
    console.log(res);
})

promise1.then((res) => {
    console.log(res);
})
