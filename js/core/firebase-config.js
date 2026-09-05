(function () {
    'use strict';

    window.firebaseConfig = {
        apiKey: 'AIzaSyBAUq-Ej45k__yEQKWJF7j-6ABXBdNt1sg',
        authDomain: 'tadbeer-864ed.firebaseapp.com',
        projectId: 'tadbeer-864ed',
        storageBucket: 'tadbeer-864ed.firebasestorage.app',
        messagingSenderId: '581455709715',
        appId: '1:581455709715:web:617a5ba227d378e3e061e6'
    };

    // Wait for Firebase SDK to be loaded
    if (typeof firebase !== 'undefined' && firebase.app) {
        try {
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.db.settings({ merge: true });
            console.log('✓ Firebase initialized successfully');
        } catch (e) {
            console.error('✗ Firebase initialization error:', e);
        }
    } else {
        console.warn('⚠ Firebase SDK not loaded yet - will retry');
        // Retry in 500ms
        setTimeout(() => {
            if (typeof firebase !== 'undefined' && firebase.app) {
                try {
                    if (!firebase.apps || firebase.apps.length === 0) {
                        firebase.initializeApp(window.firebaseConfig);
                    }
                    window.db = firebase.firestore();
                    window.auth = firebase.auth();
                    window.db.settings({ merge: true });
                    console.log('✓ Firebase initialized successfully (retry)');
                } catch (e) {
                    console.error('✗ Firebase initialization error (retry):', e);
                }
            }
        }, 500);
    }
})();
