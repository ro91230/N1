document.addEventListener('DOMContentLoaded', () => {

    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyBxLT-DBVyyHlDNvw_0LDZcrNbZsRg2k40",
        authDomain: "nicotine-store-3f1a5.firebaseapp.com",
        projectId: "nicotine-store-3f1a5",
        storageBucket: "nicotine-store-3f1a5.appspot.com",
        messagingSenderId: "209975670600",
        appId: "1:209975670600:web:79881b7c449fc67401e57d"
    };

    // --- Initialize Firebase ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // --- Global State ---
    let allProducts = [];
    let cart = [];
    let filterState = {
        category: 'الكل',
        searchTerm: '',
        sortOrder: 'default'
    };
    
    // --- DOM Elements ---
    const productsGrid = document.getElementById('products-grid');
    const categoryCards = document.querySelectorAll('.category-card');
    const searchInput = document.getElementById('search-input');
    const priceSort = document.getElementById('price-sort');
    
    // --- Utility Functions ---
    const formatCurrency = (number) => new Intl.NumberFormat('en-US').format(number);
    const openModal = (modalId) => document.getElementById(modalId).style.display = 'block';
    const closeModal = (modalId) => document.getElementById(modalId).style.display = 'none';

    // =================================================================
    // FILTERING & DISPLAY LOGIC
    // =================================================================

    const applyFiltersAndRender = () => {
        let filteredProducts = [...allProducts];

        // 1. Filter by Category
        if (filterState.category !== 'الكل') {
            filteredProducts = filteredProducts.filter(p => p.category === filterState.category);
        }

        // 2. Filter by Search Term
        if (filterState.searchTerm) {
            const searchTerm = filterState.searchTerm.toLowerCase();
            filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
        }

        // 3. Sort by Price
        if (filterState.sortOrder === 'low-to-high') {
            filteredProducts.sort((a, b) => a.price - b.price);
        } else if (filterState.sortOrder === 'high-to-low') {
            filteredProducts.sort((a, b) => b.price - a.price);
        }
        
        displayProducts(filteredProducts);
    };

    const displayProducts = (products) => {
        productsGrid.innerHTML = '';
        if (products.length === 0) {
            productsGrid.innerHTML = '<p class="loading-text">لا توجد منتجات تطابق بحثك.</p>';
            return;
        }
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.dataset.id = product.id;
            productCard.innerHTML = `
                <div class="product-badge">${product.category}</div>
                <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <div class="product-price">${formatCurrency(product.price)} د.ع</div>
                    <div class="product-button-view">عرض التفاصيل</div>
                </div>
            `;
            productsGrid.appendChild(productCard);
        });
    };
    
    const fetchProducts = async () => {
        try {
            const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
            allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();
        } catch (error) {
            console.error("Error fetching products: ", error);
            productsGrid.innerHTML = '<p class="loading-text">حدث خطأ أثناء تحميل المنتجات.</p>';
        }
    };
    
    // =================================================================
    // SINGLE PRODUCT DETAIL (MODAL)
    // =================================================================

    const displayProductDetails = (product) => {
        const detailContent = document.getElementById('product-detail-content');
        detailContent.innerHTML = `
            <span class="close-button product-detail-close">&times;</span>
            <div class="product-details-grid">
                <div class="product-details-image">
                    <img src="${product.imageUrl}" alt="${product.name}" id="main-product-image">
                </div>
                <div class="product-details-info">
                    <span class="category-badge">${product.category}</span>
                    <h1>${product.name}</h1>
                    <p class="price">${formatCurrency(product.price)} د.ع</p>
                    ${product.description ? `<p class="description">${product.description}</p>` : ''}
                    ${product.variants && product.variants.length > 0 ? `
                        <div class="product-variants">
                            <h3>${product.variants[0].type || 'خيارات'}:</h3>
                            <div class="variant-buttons" id="variant-buttons"></div>
                        </div>` : ''}
                    <button class="btn btn-primary add-to-cart-btn" id="add-to-cart-button">
                        <i class="fas fa-shopping-cart"></i> إضافة إلى السلة
                    </button>
                </div>
            </div>`;
            
        if (product.variants && product.variants.length > 0) {
            const variantsContainer = detailContent.querySelector('#variant-buttons');
            const mainImage = detailContent.querySelector('#main-product-image');
            product.variants.forEach((variant, index) => {
                const btn = document.createElement('button');
                btn.className = 'variant-btn';
                btn.textContent = variant.value;
                btn.dataset.value = variant.value;
                if (index === 0) {
                    btn.classList.add('selected');
                    if(variant.imageUrl) mainImage.src = variant.imageUrl;
                }
                btn.addEventListener('click', () => {
                    variantsContainer.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    mainImage.src = variant.imageUrl || product.imageUrl;
                });
                variantsContainer.appendChild(btn);
            });
        }

        detailContent.querySelector('#add-to-cart-button').addEventListener('click', () => {
            const selectedVariant = detailContent.querySelector('.variant-btn.selected');
            addToCart(product.id, product.name, product.price, product.imageUrl, selectedVariant ? selectedVariant.dataset.value : null);
            alert(`تمت إضافة "${product.name}" إلى السلة!`);
            closeModal('product-detail-modal');
        });

        detailContent.querySelector('.product-detail-close').addEventListener('click', () => closeModal('product-detail-modal'));
        openModal('product-detail-modal');
    };

    // =================================================================
    // CART LOGIC (UPDATED)
    // =================================================================

    const saveCart = () => localStorage.setItem('nicotineStoreCart', JSON.stringify(cart));
    const loadCart = () => { cart = JSON.parse(localStorage.getItem('nicotineStoreCart')) || []; };

    const updateCartDisplay = () => {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartCount = document.getElementById('cart-count');
        const totalPriceEl = document.getElementById('total-price');
        const checkoutButton = document.getElementById('checkout-button');
        
        loadCart();
        
        cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">سلة التسوق فارغة.</p>';
            checkoutButton.disabled = true;
        } else {
            cartItemsContainer.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <p>${item.variant ? `(${item.variant})` : ''} - ${formatCurrency(item.price)} د.ع</p>
                    </div>
                    <div class="cart-item-actions">
                        <div class="quantity-control">
                            <button class="quantity-btn" onclick="window.decreaseQuantity(${index})">-</button>
                            <span class="quantity-text">${item.quantity}</span>
                            <button class="quantity-btn" onclick="window.increaseQuantity(${index})">+</button>
                        </div>
                        <button class="delete-btn" onclick="window.removeItemFromCart(${index})"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `).join('');
            checkoutButton.disabled = false;
        }

        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalPriceEl.textContent = `المجموع: ${formatCurrency(totalPrice)} د.ع`;
    };

    window.increaseQuantity = (index) => {
        cart[index].quantity++;
        saveCart();
        updateCartDisplay();
    };

    window.decreaseQuantity = (index) => {
        if (cart[index].quantity > 1) {
            cart[index].quantity--;
            saveCart();
            updateCartDisplay();
        }
    };
    
    window.removeItemFromCart = (index) => {
        cart.splice(index, 1);
        saveCart();
        updateCartDisplay();
    };

    const addToCart = (id, name, price, image, variant) => {
        const uniqueId = variant ? id + '-' + variant : id;
        const existingItem = cart.find(item => item.uniqueId === uniqueId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ id, uniqueId, name, price, image, variant, quantity: 1 });
        }
        saveCart();
        updateCartDisplay();
    };

    // =================================================================
    // ORDER SUBMISSION
    // =================================================================
    
    document.getElementById('order-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const address = document.getElementById('customer-address').value;
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        let message = `*طلب جديد من NICOTINE STORE*\n\n`;
        message += `*الاسم:* ${name}\n*الهاتف:* ${phone}\n*العنوان:* ${address}\n\n`;
        message += `*الطلبات:*\n` + cart.map(item => 
            `- ${item.name} ${item.variant ? `(${item.variant})` : ''} (الكمية: ${item.quantity}) = ${formatCurrency(item.price * item.quantity)} د.ع`
        ).join('\n');
        message += `\n\n*المجموع الكلي: ${formatCurrency(totalPrice)} د.ع*`;

        const whatsappUrl = `https://wa.me/9647717307204?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');

        cart = [];
        saveCart();
        updateCartDisplay();
        closeModal('order-modal');
        e.target.reset();
    });

    // =================================================================
    // EVENT LISTENERS & INITIALIZATION
    // =================================================================

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            categoryCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            filterState.category = card.dataset.category;
            applyFiltersAndRender();
        });
    });

    searchInput.addEventListener('input', () => {
        filterState.searchTerm = searchInput.value;
        applyFiltersAndRender();
    });

    priceSort.addEventListener('change', () => {
        filterState.sortOrder = priceSort.value;
        applyFiltersAndRender();
    });

    productsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (card) {
            const productId = card.dataset.id;
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                displayProductDetails(product);
            }
        }
    });

    document.querySelector('.mobile-menu-btn').addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });

    document.getElementById('cart-button').addEventListener('click', () => openModal('cart-modal'));
    document.getElementById('checkout-button').addEventListener('click', () => {
        if (cart.length > 0) {
            closeModal('cart-modal');
            openModal('order-modal');
        }
    });

    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Initial Load
    fetchProducts();
    updateCartDisplay();
});
