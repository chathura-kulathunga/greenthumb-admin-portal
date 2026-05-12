import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Links
const loginGate = document.getElementById('loginGate');
const masterDashboard = document.getElementById('masterDashboard');

// --- 1. AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginGate.classList.add('hidden');
        masterDashboard.classList.remove('hidden');
        initDashboardData();
    } else {
        loginGate.classList.remove('hidden');
        masterDashboard.classList.add('hidden');
    }
});

document.getElementById('btnLogin').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('adminEmail').value, document.getElementById('adminPassword').value)
        .catch(() => { document.getElementById('loginError').textContent = "Access Denied: Invalid Credentials"; });
});
document.getElementById('btnLogout').addEventListener('click', () => { signOut(auth); });

// --- 2. NAVIGATION ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-target')).classList.remove('hidden');
    });
});

// --- 3. MODAL LOGIC (ADD / EDIT) ---
const productModal = document.getElementById('productModal');
const btnAddProduct = document.getElementById('btnAddProduct');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnSaveProduct = document.getElementById('btnSaveProduct');

// Inputs
const pId = document.getElementById('productId');
const pName = document.getElementById('pName');
const pCat = document.getElementById('pCategory');
const pPrice = document.getElementById('pPrice');
const pStock = document.getElementById('pStock');
const modalTitle = document.getElementById('modalTitle');

btnAddProduct.addEventListener('click', () => {
    pId.value = ''; pName.value = ''; pCat.value = ''; pPrice.value = ''; pStock.value = '';
    modalTitle.innerText = "Add New Product";
    productModal.classList.remove('hidden');
});

btnCancelModal.addEventListener('click', () => { productModal.classList.add('hidden'); });

btnSaveProduct.addEventListener('click', async () => {
    const productData = {
        name: pName.value,
        category: pCat.value,
        price: Number(pPrice.value),
        stock: Number(pStock.value)
    };

    try {
        if (pId.value === "") {
            // Create New Product
            await addDoc(collection(db, "plants"), productData);
        } else {
            // Update Existing Product
            const plantRef = doc(db, "plants", pId.value);
            await updateDoc(plantRef, productData);
        }
        productModal.classList.add('hidden'); // Close modal on success
    } catch (e) {
        alert("Error saving product: " + e.message);
    }
});

// Global Edit/Delete Functions for Inline Buttons
window.editProduct = function(id, name, cat, price, stock) {
    pId.value = id; pName.value = name; pCat.value = cat; pPrice.value = price; pStock.value = stock;
    modalTitle.innerText = "Edit Product";
    productModal.classList.remove('hidden');
}

window.deleteProduct = async function(id) {
    if(confirm("Are you sure you want to delete this plant?")) {
        await deleteDoc(doc(db, "plants", id));
    }
}


// --- 4. DATA SYNCING ---
function initDashboardData() {
    
    // 1. Sync Orders & Calculate Revenue
    onSnapshot(collection(db, "orders"), (snapshot) => {
        let totalOrders = 0;
        let totalRev = 0;
        const ordersList = document.getElementById('ordersList');
        ordersList.innerHTML = ''; 

        if (snapshot.empty) {
            ordersList.innerHTML = '<tr><td colspan="5" class="placeholder-text">No orders found yet.</td></tr>';
        } else {
            snapshot.forEach((doc) => {
                const data = doc.data();
                totalOrders++;
                
                // Force math calculation to prevent string bugs
                const orderTotal = Number(data.totalPrice) || 0; 
                totalRev += orderTotal;
                
                ordersList.innerHTML += `
                    <tr>
                        <td>#${doc.id.substring(0,6).toUpperCase()}</td>
                        <td>${data.customerName || 'Guest'}</td>
                        <td>LKR ${orderTotal.toFixed(2)}</td>
                        <td><span class="live-status">${data.status || 'Pending'}</span></td>
                        <td><button class="action-btn">Manage</button></td>
                    </tr>
                `;
            });
        }
        document.getElementById('statOrders').innerText = totalOrders;
        document.getElementById('statRevenue').innerText = `LKR ${totalRev.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    });

    // 2. Sync Products (with Edit/Delete buttons wired up)
    onSnapshot(collection(db, "plants"), (snapshot) => {
        const productsList = document.getElementById('productsList');
        productsList.innerHTML = '';
        document.getElementById('statProducts').innerText = snapshot.size;

        if (snapshot.empty) return;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const safeName = data.name ? data.name.replace(/'/g, "\\'") : 'Unnamed';
            const safeCat = data.category ? data.category.replace(/'/g, "\\'") : 'N/A';
            
            productsList.innerHTML += `
                <tr>
                    <td><strong>${data.name || 'Unnamed'}</strong></td>
                    <td>${data.category || 'N/A'}</td>
                    <td>LKR ${Number(data.price || 0).toFixed(2)}</td>
                    <td>${data.stock || 0} units</td>
                    <td>
                        <button class="action-btn" onclick="editProduct('${doc.id}', '${safeName}', '${safeCat}', ${data.price || 0}, ${data.stock || 0})">Edit</button>
                        <button class="btn-danger" style="margin-left:5px;" onclick="deleteProduct('${doc.id}')">Del</button>
                    </td>
                </tr>
            `;
        });
    });

    // 3. Sync Reviews
    onSnapshot(collection(db, "reviews"), (snapshot) => {
        const reviewsList = document.getElementById('reviewsList');
        reviewsList.innerHTML = '';

        if (snapshot.empty) {
            reviewsList.innerHTML = '<tr><td colspan="5" class="placeholder-text">No reviews published yet.</td></tr>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            reviewsList.innerHTML += `
                <tr>
                    <td><strong>${data.userName || 'Anonymous'}</strong></td>
                    <td>${data.plantName || 'Unknown Product'}</td>
                    <td>⭐ ${data.rating || 5}/5</td>
                    <td>"${data.comment || ''}"</td>
                    <td><button class="btn-danger" onclick="deleteDoc(doc(db, 'reviews', '${doc.id}'))">Remove</button></td>
                </tr>
            `;
        });
    });
}