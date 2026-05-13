import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Links
const loginGate = document.getElementById('loginGate');
const masterDashboard = document.getElementById('masterDashboard');

// Global Data Cache (Solves the Base64 Edit Crash)
window.plantDataCache = {};

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

// --- 3. BASE64 IMAGE COMPRESSOR ---
function compressImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6)); 
            };
        };
        reader.onerror = error => reject(error);
    });
}

// --- 4. DYNAMIC IMAGE & PRODUCT MODAL ---
let existingImages = []; // Stores Base64 from database
let selectedImages = []; // Stores new File objects
const pImageInput = document.getElementById('pImageInput');
const previewContainer = document.getElementById('imagePreviewContainer');
const productError = document.getElementById('productError');

pImageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if(validFiles.length !== files.length) {
        showProductError("Invalid file type. Please upload images only.");
    }
    
    selectedImages = selectedImages.concat(validFiles);
    renderImagePreviews();
    pImageInput.value = ""; 
});

function renderImagePreviews() {
    previewContainer.innerHTML = '';
    
    // 1. Draw Existing Images
    existingImages.forEach((base64Str, index) => {
        const div = document.createElement('div');
        div.className = 'img-thumb-wrapper';
        div.innerHTML = `
            <img src="${base64Str}">
            <button class="remove-img-btn" onclick="removeExistingImage(${index})">X</button>
        `;
        previewContainer.appendChild(div);
    });

    // 2. Draw Newly Selected Images
    selectedImages.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'img-thumb-wrapper';
            div.innerHTML = `
                <img src="${e.target.result}">
                <button class="remove-img-btn" onclick="removeSelectedImage(${index})">X</button>
            `;
            previewContainer.appendChild(div);
        }
        reader.readAsDataURL(file);
    });
}

window.removeExistingImage = function(index) {
    existingImages.splice(index, 1);
    renderImagePreviews();
}

window.removeSelectedImage = function(index) {
    selectedImages.splice(index, 1);
    renderImagePreviews();
}

function showProductError(msg) {
    productError.textContent = msg;
    productError.classList.remove('hidden');
}

// OPEN ADD MODAL
document.getElementById('btnAddProduct').addEventListener('click', () => {
    document.getElementById('productId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pCategory').value = '';
    document.getElementById('pDesc').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pStock').value = '';
    document.getElementById('pDelivery').value = '';
    existingImages = [];
    selectedImages = [];
    renderImagePreviews();
    productError.classList.add('hidden');
    document.getElementById('modalTitle').innerText = "Add New Product";
    document.getElementById('productModal').classList.remove('hidden');
});

document.getElementById('btnCancelModal').addEventListener('click', () => { 
    document.getElementById('productModal').classList.add('hidden'); 
});

// SAVE LOGIC
document.getElementById('btnSaveProduct').addEventListener('click', async () => {
    const id = document.getElementById('productId').value;
    const name = document.getElementById('pName').value.trim();
    const cat = document.getElementById('pCategory').value;
    const desc = document.getElementById('pDesc').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const stock = parseInt(document.getElementById('pStock').value);
    const deliveryFee = parseFloat(document.getElementById('pDelivery').value) || 0; // Default to 0

    if (!name || !cat || !desc || isNaN(price) || isNaN(stock)) {
        return showProductError("All text and number fields must be filled correctly.");
    }
    if (price < 0 || stock < 0 || deliveryFee < 0) {
        return showProductError("Price, Stock, and Delivery Fee cannot be negative.");
    }
    
    // EXACTLY 3 IMAGES COMBINED RULE
    const totalImages = existingImages.length + selectedImages.length;
    if (totalImages !== 3) {
        return showProductError(`You must have exactly 3 images total. You currently have ${totalImages}.`);
    }

    document.getElementById('btnSaveProduct').innerText = "Processing & Saving...";
    document.getElementById('btnSaveProduct').disabled = true;

    try {
        let finalImages = [...existingImages]; // Start with the kept existing images
        
        // Compress and append new images
        for (let i = 0; i < selectedImages.length; i++) {
            const base64String = await compressImageToBase64(selectedImages[i]);
            finalImages.push(base64String);
        }

        const productData = { 
            name, 
            category: cat, 
            description: desc, 
            price, 
            stock,
            deliveryFee,
            imageUrl: finalImages[0] || "",
            imageUrl2: finalImages[1] || "",
            imageUrl3: finalImages[2] || ""
        };

        if (id === "") {
            await addDoc(collection(db, "plants"), productData);
        } else {
            await updateDoc(doc(db, "plants", id), productData);
        }
        
        document.getElementById('productModal').classList.add('hidden');
    } catch (e) {
        showProductError("Upload Failed. See console for details.");
        console.error(e);
    } finally {
        document.getElementById('btnSaveProduct').innerText = "Save Product";
        document.getElementById('btnSaveProduct').disabled = false;
    }
});

// EDIT FUNCTION (Pulls from Global Cache securely)
window.editProduct = function(id) {
    const data = window.plantDataCache[id]; // Fetch full data from cache
    if(!data) return alert("Error loading product data.");

    document.getElementById('productId').value = id; 
    document.getElementById('pName').value = data.name || ''; 
    document.getElementById('pCategory').value = data.category || ''; 
    document.getElementById('pDesc').value = data.description || ''; 
    document.getElementById('pPrice').value = data.price || 0; 
    document.getElementById('pStock').value = data.stock || 0;
    document.getElementById('pDelivery').value = data.deliveryFee || 0;
    
    // Load existing images
    existingImages = [];
    selectedImages = [];
    if(data.imageUrl) existingImages.push(data.imageUrl);
    if(data.imageUrl2) existingImages.push(data.imageUrl2);
    if(data.imageUrl3) existingImages.push(data.imageUrl3);
    
    renderImagePreviews();
    productError.classList.add('hidden');
    document.getElementById('modalTitle').innerText = "Edit Product";
    document.getElementById('productModal').classList.remove('hidden');
}

window.deleteProduct = async function(id) {
    if(confirm("Are you sure you want to permanently delete this plant?")) {
        await deleteDoc(doc(db, "plants", id));
    }
}

// --- 5. ORDER MANAGEMENT MODAL (DUAL UPDATE SYSTEM) ---
window.manageOrder = function(id, userId, name, total, status) {
    document.getElementById('manageOrderId').value = id;
    document.getElementById('manageOrderUserId').value = userId; // Store the mobile user's ID
    document.getElementById('manageOrderDetails').innerText = `Customer: ${name} | Order Total: LKR ${parseFloat(total).toFixed(2)}`;
    document.getElementById('oStatus').value = status;
    document.getElementById('orderError').classList.add('hidden');
    document.getElementById('orderModal').classList.remove('hidden');
}

document.getElementById('btnCancelOrderModal').addEventListener('click', () => {
    document.getElementById('orderModal').classList.add('hidden');
});

document.getElementById('btnSaveOrder').addEventListener('click', async () => {
    const id = document.getElementById('manageOrderId').value;
    const userId = document.getElementById('manageOrderUserId').value;
    const newStatus = document.getElementById('oStatus').value;
    
    try {
        // 1. Update the Master Dashboard Document
        await updateDoc(doc(db, "orders", id), { status: newStatus });
        
        // 2. Update the Mobile App's "Carbon Copy" so the app reacts in real-time!
        if (userId && userId !== "undefined") {
            await updateDoc(doc(db, "users", userId, "orders", id), { status: newStatus });
        }

        document.getElementById('orderModal').classList.add('hidden');
    } catch (e) {
        document.getElementById('orderError').textContent = "Failed to update order status.";
        document.getElementById('orderError').classList.remove('hidden');
    }
});

// --- 6. DATA SYNCING ---
function initDashboardData() {
    // 1. Orders Sync
    onSnapshot(collection(db, "orders"), (snapshot) => {
        let totalOrders = 0; let totalRev = 0;
        const ordersList = document.getElementById('ordersList');
        ordersList.innerHTML = ''; 

        if (snapshot.empty) {
            ordersList.innerHTML = '<tr><td colspan="5" class="placeholder-text">No orders found yet.</td></tr>';
        } else {
            snapshot.forEach((doc) => {
                const data = doc.data();
                totalOrders++;
                
                const orderTotal = Number(data.totalPrice) || 0; 
                
                // Only add to revenue if Delivered!
                if (data.status === "Delivered") {
                    totalRev += orderTotal;
                }
                
                const safeName = data.customerName ? data.customerName.replace(/'/g, "\\'") : 'Guest';
                const safeUserId = data.userId || ''; // Fetch the ID from the db
                
                ordersList.innerHTML += `
                    <tr>
                        <td>#${doc.id.substring(0,6).toUpperCase()}</td>
                        <td>${safeName}</td>
                        <td>LKR ${orderTotal.toFixed(2)}</td>
                        <td><span class="live-status">${data.status || 'Pending'}</span></td>
                        <td><button class="action-btn" onclick="manageOrder('${doc.id}', '${safeUserId}', '${safeName}', ${orderTotal}, '${data.status || 'Pending'}')">Manage</button></td>
                    </tr>
                `;
            });
        }
        document.getElementById('statOrders').innerText = totalOrders;
        document.getElementById('statRevenue').innerText = `LKR ${totalRev.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    });

    // 2. Plants Sync
    onSnapshot(collection(db, "plants"), (snapshot) => {
        const productsList = document.getElementById('productsList');
        productsList.innerHTML = '';
        document.getElementById('statProducts').innerText = snapshot.size;

        if (snapshot.empty) return;
        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // Save to local cache so the Edit button can find it!
            window.plantDataCache[doc.id] = data; 
            
            productsList.innerHTML += `
                <tr>
                    <td><strong>${data.name || 'Unnamed'}</strong></td>
                    <td>${data.category || 'N/A'}</td>
                    <td>LKR ${Number(data.price || 0).toFixed(2)}</td>
                    <td>${data.stock || 0} units</td>
                    <td>
                        <button class="action-btn" onclick="editProduct('${doc.id}')">Edit</button>
                        <button class="btn-danger" style="margin-left:5px;" onclick="deleteProduct('${doc.id}')">Del</button>
                    </td>
                </tr>
            `;
        });
    });

    // 3. Reviews Sync
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