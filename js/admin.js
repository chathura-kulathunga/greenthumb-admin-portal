import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const loginGate = document.getElementById('loginGate');
const masterDashboard = document.getElementById('masterDashboard');
const emailInput = document.getElementById('adminEmail');
const passInput = document.getElementById('adminPassword');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const loginError = document.getElementById('loginError');

// --- 1. AUTHENTICATION ENGINE ---
// Listen for auth state changes to hide/show dashboard
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginGate.classList.add('hidden');
        masterDashboard.classList.remove('hidden');
        initLiveChart(); // Start the charts when logged in
    } else {
        loginGate.classList.remove('hidden');
        masterDashboard.classList.add('hidden');
    }
});

// Login Execution
btnLogin.addEventListener('click', () => {
    const email = emailInput.value;
    const pass = passInput.value;
    
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => { loginError.textContent = ""; })
        .catch((error) => { loginError.textContent = "Access Denied: Invalid Credentials"; });
});

// Logout Execution
btnLogout.addEventListener('click', () => { signOut(auth); });


// --- 2. NAVIGATION ENGINE ---
const navButtons = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.panel');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        navButtons.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.add('hidden'));

        // Add active class to clicked
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
    });
});


// --- 3. LIVE DASHBOARD & CHARTS ENGINE ---
function initLiveChart() {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    // Create Chart.js Instance
    const revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Weekly Revenue (LKR)',
                data: [12000, 19000, 15000, 25000, 22000, 30000, 28000], // Placeholder data
                borderColor: '#2A4D34',
                backgroundColor: 'rgba(42, 77, 52, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    /* SENIOR DEV NOTE: 
       To make this truly live, we use Firestore's onSnapshot. 
       This listens to the database and updates the UI instantly if an order comes in! 
    */
    const ordersRef = collection(db, "orders");
    onSnapshot(ordersRef, (snapshot) => {
        let totalOrders = 0;
        let totalRevenue = 0;
        
        snapshot.forEach((doc) => {
            totalOrders++;
            totalRevenue += doc.data().totalPrice || 0;
            // Here we would also push data into the HTML table...
        });

        document.getElementById('statOrders').innerText = totalOrders;
        document.getElementById('statRevenue').innerText = `LKR ${totalRevenue.toFixed(2)}`;
    });
}