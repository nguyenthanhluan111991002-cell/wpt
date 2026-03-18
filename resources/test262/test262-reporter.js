/**
 * @fileoverview Test262-specific reporter for WPT.
 * This script runs inside the test iframe. It captures errors and completion
 * signals and communicates them to the parent window (test262-harness-bridge.js).
 *
 * This implementation strictly follows the TC39 Test262 INTERPRETING.md:
 * https://github.com/tc39/test262/blob/main/INTERPRETING.md
 */
(function() {
    /**
     * Minimalistic Test262 error constructor.
     * Often overwritten by the real one from third_party/test262/harness/assert.js.
     */
    function Test262Error(message) {
        this.message = message || "";
    }
    Test262Error.prototype.name = "Test262Error";
    self.Test262Error = Test262Error;

    // We stash these in case the test overrides them
    const Object_prototype_toString = Object.prototype.toString;
    const Error_prototype_toString = Error.prototype.toString;
    const String_prototype_indexOf = String.prototype.indexOf;
    const parentWindow = window.parent;

    let expectedType;
    let expectedPhase;
    let isAsync = false;
    let test_finished = false;
    let status = 0;
    let message = "OK";

    window.test262Setup = function() {
    };

    window.test262IsAsync = function(b) {
        isAsync = b;
        window.test262Async = b; // For synchronization with server-injected scripts
    };

    window.test262NegativeType = function(t) {
        expectedType = t;
        // Default message for negative tests
        message = "Expected " + t;
        // Negative tests fail if they complete without throwing
        status = 1;
    };

    window.test262NegativePhase = function(p) {
        expectedPhase = p;
    };

    /**
     * TC39 INTERPRETING.md: Async tests use the print function.
     * print('Test262:AsyncTestComplete') -> PASS
     * print('Test262:AsyncTestFailure: ' + reason) -> FAIL
     */
    window.print = function(s) {
        if (s === 'Test262:AsyncTestComplete') {
            status = 0;
            message = "OK";
            done();
        } else if (typeof s === 'string' && String_prototype_indexOf.call(s, 'Test262:AsyncTestFailure:') === 0) {
            status = 1;
            message = s;
            done();
        }
    };

    function done() {
        if (test_finished) {
            return;
        }

        // If we expected an error but didn't get one (and haven't reported success yet)
        if (status === 1 && expectedType && message === "Expected " + expectedType) {
            message = "Expected " + expectedType + " but test completed without error.";
        }

        test_finished = true;
        if (status === 0) {
            parentWindow.postMessage({ type: 'complete' }, '*');
        } else if (status === 1) {
            parentWindow.postMessage({ type: 'fail', message: message }, '*');
        } else {
            parentWindow.postMessage({ type: 'error', message: message }, '*');
        }
    }
    window.test262Done = done;

    window.addEventListener("load", function() {
        if (!isAsync && !window.__test262IsModule) {
            done();
        }
    });

    function on_error(event) {
        // This hack ensures that errors thrown inside of a $262.evalScript get
        // rethrown in the correct place.
        if (event.error && String_prototype_indexOf.call(event.error.message, "Failed to execute 'appendChild' on 'Node'") === 0) {
            window.__test262_evalScript_error_ = event.error;
            return;
        }

        if (test_finished) return;

        /**
         * INTERPRETING.md Handling Errors and Negative Test Cases:
         * A test is passing if it throws an uncaught exception of the expected type.
         */
        let errorMatches = false;
        if (expectedType && event.error) {
            if (String_prototype_indexOf.call(event.error.toString(), expectedType) === 0 ||
                String_prototype_indexOf.call(Error_prototype_toString.call(event.error), expectedType) === 0) {
                errorMatches = true;
            }
        } else if (expectedType && event.message && String_prototype_indexOf.call(event.message, expectedType) === 0) {
            errorMatches = true;
        }

        if (errorMatches) {
            status = 0; // OK
            message = "OK";
        } else if (event.error && (event.error instanceof self.Test262Error)) {
            status = 1; // FAIL
            message = event.error.message || "Test262Error";
        } else {
            // Other error (or type mismatch for negative test)
            status = 2; // ERROR
            message = event.message || (event.error ? event.error.toString() : "Unknown Error");
            if (expectedType) {
                message = "Expected " + expectedType + " but got " + message;
            }
        }
        done();
    }

    window.addEventListener("error", on_error);
    window.addEventListener("unhandledrejection", function(event) {
        on_error({
            message: "Unhandled promise rejection: " + event.reason,
            error: event.reason
        });
    });

    // Special runner alias
    window.$DONTEVALUATE = function() {};
})();
