/**
 * @fileoverview Bridge for the WPT testharness.js to run Test262 tests.
 * This bridge resides in the top-level window and acts as an adapter between
 * the Test262-specific reporter in the iframe and the WPT test harness.
 */
(function() {
    // Set explicit_done to true to prevent the harness from completing
    // synchronously after the subtest finishes. This ensures that we can
    // capturte asynchronous signals (print()) and handle harness-level
    // errors (status 2) correctly before the test is finalized.
    setup({ explicit_done: true });

    // Create a single WPT async_test. The name is derived from the document
    // title (usually "Test") to match WPT infrastructure conventions.
    const t = async_test(document.title);

    window.addEventListener('message', (event) => {
        const iframe = document.getElementById('test262-iframe');
        if (!iframe || iframe.contentWindow !== event.source) {
            return;
        }

        /**
         * The communication protocol with test262-reporter.js (inside the iframe)
         * sends a structured object payload:
         * - { type: 'complete' }
         * - { type: 'fail', message: '...' }
         * - { type: 'error', message: '...' }
         *
         * Note: Additional types like 'timeout' or 'precondition_failed'
         * can be added here in the future to support automated feature-skipping
         * or internal async watchdogs.
         */
        if (event.data && typeof event.data === 'object') {
            if (event.data.type === 'complete') {
                t.step(() => {
                    t.done();
                });
                done(); // Signal harness completion
            } else if (event.data.type === 'fail') {
                t.step(() => {
                    assert_unreached(event.data.message || "Test failed");
                });
                done(); // Signal harness completion
            } else if (event.data.type === 'error') {
                t.step(() => {
                    assert_unreached(event.data.message || "Harness Error");
                });
                throw new Error(event.data.message || "Harness Error");
            }
        }
    });
})();
