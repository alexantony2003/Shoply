(() => {
  const labels = {
    admin: 'Admin dashboard',
    cart: 'Cart',
    categories: 'Categories',
    edit: 'Edit',
    checkout: 'Checkout',
    'edit-profile': 'Edit profile',
    'forgot-password': 'Password reset',
    inventory: 'Inventory',
    login: 'Login',
    new: 'New product',
    orders: 'Orders',
    'order-success': 'Order confirmed',
    products: 'Products',
    profile: 'Profile',
    register: 'Register',
    settings: 'Settings',
    users: 'Users',
    addresses: 'Addresses',
    wishlist: 'Wishlist',
    'product-details': 'Product details',
  };
  const segments = window.location.pathname.split('/').filter(Boolean);
  const visibleSegments = segments.filter((segment) => !/^(\d+|SHP-\d+)$/i.test(segment));
  const productName = (typeof document !== 'undefined' && document.body && document.body.dataset) ? document.body.dataset.productName : '';
  const isProductId = (segment) => /^[a-f\d]{24}$/i.test(segment);
  const isAdminPage = segments[0] === 'admin';
  const hasPageBreadcrumb = document.querySelector('.breadcrumbs[aria-label="Breadcrumb"]');

  const normalizeStoreNavigation = (nav) => {
    const entries = [
      ['Home', '/'],
      ['Shop', '/products'],
      ['Cart', '/cart'],
      ['Wishlist', '/wishlist']
    ];
    const children = Array.from(nav.children);
    const hasProfileMenu = children.some((child) => child.classList.contains('profile-container'));
    const existingLinks = new Map();
    const extras = [];

    children.forEach((child) => {
      if (child.classList.contains('theme-toggle-btn')) {
        extras.push(child);
        return;
      }
      const href = child.matches('a') ? child.getAttribute('href') : null;
      const isCoreLink = entries.some(([, target]) => target === href);
      if (isCoreLink && !existingLinks.has(href)) {
        existingLinks.set(href, child);
      } else if (href === '/profile' && !hasProfileMenu && !existingLinks.has(href)) {
        existingLinks.set(href, child);
      } else {
        extras.push(child);
      }
    });

    // Rebuild nav in a clean order
    nav.innerHTML = '';
    entries.concat(hasProfileMenu ? [] : [['Account', '/profile']]).forEach(([label, href]) => {
      const link = existingLinks.get(href) || document.createElement('a');
      link.href = href;
      link.textContent = label === 'Shop' && existingLinks.has('/products') && existingLinks.get('/products').textContent.trim() && existingLinks.get('/products').textContent.trim() !== 'Shop'
        ? existingLinks.get('/products').textContent.trim()
        : (label === 'Home' && existingLinks.has('/') && existingLinks.get('/').textContent.trim() && existingLinks.get('/').textContent.trim().toLowerCase() !== 'home'
          ? existingLinks.get('/').textContent.trim()
          : label);
      // Prefer existing label if it was customized
      const existing = existingLinks.get(href);
      if (existing && existing.textContent.trim()) {
        link.textContent = existing.textContent.trim();
      }
      nav.appendChild(link);
    });
    extras.forEach((child) => nav.appendChild(child));
  };

  const addAdminNavigationLink = (nav) => {
    if (!document.body || !document.body.dataset || document.body.dataset.userRole !== 'admin') return;

    const existingLink = Array.from(nav.children).find((child) =>
      child.matches('a[href="/admin"]')
    );
    const adminLink = existingLink || document.createElement('a');
    adminLink.className = 'admin-dashboard-link';
    adminLink.href = '/admin';
    adminLink.textContent = 'Admin';
    const profileMenu = Array.from(nav.children).find((child) =>
      child.classList.contains('profile-container')
    );
    const themeToggle = Array.from(nav.children).find((child) =>
      child.classList.contains('theme-toggle-btn')
    );
    nav.insertBefore(adminLink, profileMenu || themeToggle || null);
  };

  document.querySelectorAll('header').forEach((header) => {
    header.classList.add('site-header', 'glass-card');
    const nav = header.querySelector('nav');
    if (nav) {
      nav.classList.add('glass-card');
      if (!nav.hasAttribute('aria-label')) nav.setAttribute('aria-label', 'Main navigation');
      normalizeStoreNavigation(nav);
      addAdminNavigationLink(nav);
    }
  });

  document.querySelectorAll([
    'header.site-header',
    '.site-header nav',
    '.category-rail'
  ].join(',')).forEach((surface) => surface.classList.add('glass-card'));

  if (!isAdminPage && !document.querySelector('header')) {
    const header = document.createElement('header');
    header.className = 'site-header site-header-generated glass-card';
    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = '/';
    brand.textContent = 'Shoply';
    const nav = document.createElement('nav');
    nav.className = 'glass-card';
    nav.setAttribute('aria-label', 'Main navigation');
    normalizeStoreNavigation(nav);
    addAdminNavigationLink(nav);
    header.append(brand, nav);
    document.body.prepend(header);
  }

  // --------------------------------------------------
  // THEME MANAGEMENT (Light & Dark Mode)
  // --------------------------------------------------
  const THEME_STORAGE_KEY = 'shoply-theme';

  const getActiveTheme = () => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (_) {}
    return 'light';
  };

  const updateToggleButtonsUI = (theme) => {
    const isDark = theme === 'dark';
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.setAttribute('title', isDark ? 'Switch to Light mode' : 'Switch to Dark mode');
      btn.setAttribute('aria-label', isDark ? 'Switch to Light mode' : 'Switch to Dark mode');

      const icon = isDark
        ? '<svg class="theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg class="theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

      btn.innerHTML = `${icon}<span class="theme-text">${isDark ? 'Light mode' : 'Dark mode'}</span>`;
    });
  };

  const applyTheme = (theme, persist = true) => {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (document.body) {
      document.body.setAttribute('data-theme', nextTheme);
    }
    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch (_) {}
    }
    updateToggleButtonsUI(nextTheme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: nextTheme } }));
  };

  const createThemeToggleElement = (extraClass = '') => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `theme-toggle-btn ${extraClass}`.trim();
    btn.setAttribute('aria-label', 'Toggle light/dark theme');
    return btn;
  };

  const mountThemeToggles = () => {
    // 1. Storefront Navigation
    document.querySelectorAll('header.site-header nav, .account-header > nav').forEach((nav) => {
      if (!nav.querySelector('.theme-toggle-btn')) {
        nav.appendChild(createThemeToggleElement('store-theme-toggle'));
      }
    });

    // 2. Admin Top Header - avoid duplicates if sidebar toggle exists
    const adminHeader = document.querySelector('.dash-page-header');
    const hasSidebarToggle = document.querySelector('.admin-sidebar-theme-toggle');
    if (adminHeader && !adminHeader.querySelector('.admin-theme-toggle') && !hasSidebarToggle) {
      const statusWrap = adminHeader.querySelector('.dash-header-status');
      const toggle = createThemeToggleElement('admin-theme-toggle');
      if (statusWrap && statusWrap.parentNode) {
        statusWrap.parentNode.insertBefore(toggle, statusWrap);
      } else {
        adminHeader.appendChild(toggle);
      }
    }

    updateToggleButtonsUI(document.documentElement.getAttribute('data-theme') || getActiveTheme());
  };

  // Single delegated click listener for theme toggle (eliminates duplicate event fires)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-toggle-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
  });

  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    } else if (typeof mq.addListener === 'function') {
      mq.addListener((e) => {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  } catch (_) {}

  // Apply theme early if not already set
  if (!document.documentElement.getAttribute('data-theme')) {
    applyTheme(getActiveTheme(), false);
  }

  mountThemeToggles();

  // Horizontal mouse-wheel scrolling for category rail
  const categoryRailElement = document.querySelector('.category-rail');
  if (categoryRailElement) {
    categoryRailElement.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0 && categoryRailElement.scrollWidth > categoryRailElement.clientWidth) {
        e.preventDefault();
        categoryRailElement.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // Global Profile Menu Support
  document.addEventListener('click', (event) => {
    const profileContainer = document.querySelector('.profile-container');
    const menu = document.getElementById('profileMenu');
    const btn = document.getElementById('account-menu-button');
    if (!profileContainer || !menu) return;

    if (btn && btn.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      return;
    }

    if (!profileContainer.contains(event.target)) {
      menu.classList.remove('show');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const menu = document.getElementById('profileMenu');
      const btn = document.getElementById('account-menu-button');
      if (menu && menu.classList.contains('show')) {
        menu.classList.remove('show');
        if (btn) {
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      }
    }
  });

  // Polished Breadcrumbs System
  const buildBreadcrumbs = () => {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    if (currentPath === '/') return; // Never show breadcrumbs on root homepage

    const homeSvg = '<svg class="breadcrumb-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
    const adminSvg = '<svg class="breadcrumb-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
    const chevronSvg = '<span class="breadcrumb-separator" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>';

    // Check if page already has static breadcrumbs (e.g. products.ejs, product-details.ejs)
    const existing = document.querySelector('.breadcrumbs[aria-label="Breadcrumb"], .breadcrumb[aria-label="Breadcrumb"]');
    if (existing) {
      existing.classList.add('glass-card');
      const homeLink = existing.querySelector('a[href="/"]');
      if (homeLink && !homeLink.querySelector('.breadcrumb-icon')) {
        homeLink.insertAdjacentHTML('afterbegin', homeSvg + ' ');
      }
      return;
    }

    const pathSegments = currentPath.split('/').filter(Boolean);
    if (!pathSegments.length) return;

    const nav = document.createElement('nav');
    nav.className = 'breadcrumb glass-card' + (isAdminPage ? ' admin-breadcrumb' : '');
    nav.setAttribute('aria-label', 'Breadcrumb');

    const crumbs = [];

    if (isAdminPage) {
      crumbs.push({ label: 'Admin', href: '/admin', icon: adminSvg });
      const adminSub = pathSegments.slice(1);
      if (adminSub.length === 0 || (adminSub.length === 1 && adminSub[0] === 'dashboard')) {
        crumbs.push({ label: 'Dashboard', current: true });
      } else {
        let accHref = '/admin';
        for (let i = 0; i < adminSub.length; i++) {
          const seg = adminSub[i];
          accHref += '/' + seg;
          const isLast = i === adminSub.length - 1;
          const prevSeg = i > 0 ? adminSub[i - 1] : '';

          let label = seg;
          if (seg === 'products') label = 'Products';
          else if (seg === 'categories') label = 'Categories';
          else if (seg === 'inventory') label = 'Inventory';
          else if (seg === 'orders') label = 'Orders';
          else if (seg === 'users') label = 'Users';
          else if (seg === 'settings') label = 'Settings';
          else if (seg === 'offers') label = 'Offers';
          else if (seg === 'sales-report') label = 'Sales report';
          else if (seg === 'profile') label = 'My profile';
          else if (seg === 'new') {
            label = prevSeg === 'products' ? 'Add product' : (prevSeg === 'categories' ? 'Add category' : 'New');
          } else if (seg === 'edit') {
            label = prevSeg === 'products' ? 'Edit product' : (prevSeg === 'categories' ? 'Edit category' : 'Edit');
          } else if (/^[a-f\d]{24}$/i.test(seg) || /^\d+$/.test(seg)) {
            const nextSeg = adminSub[i + 1];
            if (nextSeg === 'edit') continue;
            label = 'Details';
          } else {
            label = seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          }

          crumbs.push({ label, href: accHref, current: isLast });
        }
      }
    } else {
      crumbs.push({ label: 'Home', href: '/', icon: homeSvg });

      let accHref = '';
      for (let i = 0; i < pathSegments.length; i++) {
        const seg = pathSegments[i];
        accHref += '/' + seg;
        const isLast = i === pathSegments.length - 1;
        const prevSeg = i > 0 ? pathSegments[i - 1] : '';

        let label = seg;
        if (seg === 'products') {
          label = 'Shop';
        } else if (seg === 'cart') {
          label = 'Cart';
        } else if (seg === 'wishlist') {
          label = 'Wishlist';
        } else if (seg === 'checkout') {
          if (crumbs.length === 1) crumbs.push({ label: 'Cart', href: '/cart' });
          label = 'Checkout';
        } else if (seg === 'orders') {
          label = 'My orders';
        } else if (seg === 'profile') {
          label = 'My profile';
        } else if (seg === 'edit' && prevSeg === 'profile') {
          label = 'Edit profile';
        } else if (seg === 'addresses') {
          label = 'Addresses';
        } else if (seg === 'new' && prevSeg === 'addresses') {
          label = 'Add address';
        } else if (seg === 'edit' && prevSeg === 'addresses') {
          label = 'Edit address';
        } else if (seg === 'login') {
          label = 'Sign in';
        } else if (seg === 'register') {
          label = 'Create account';
        } else if (seg === 'forgot-password') {
          label = 'Forgot password';
        } else if (seg === 'reset-password') {
          label = 'Reset password';
        } else if (seg === 'verify-otp') {
          label = 'Verify OTP';
        } else if (seg === 'invoice') {
          label = 'Invoice';
        } else if (isProductId(seg)) {
          label = productName || 'Product details';
        } else if (/^(\d+|SHP-\d+)$/i.test(seg) || (/^[a-f\d]{24}$/i.test(seg) && prevSeg === 'orders')) {
          const h1Text = document.querySelector('h1, .page-title-row h1')?.textContent?.trim();
          label = (h1Text && /^ORD-/i.test(h1Text)) ? h1Text : `Order details`;
        } else {
          label = labels[seg] || seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }

        crumbs.push({ label, href: accHref, current: isLast });
      }
    }

    crumbs.forEach((crumb, idx) => {
      if (idx > 0) {
        nav.insertAdjacentHTML('beforeend', chevronSvg);
      }
      if (crumb.current || !crumb.href) {
        const span = document.createElement('span');
        span.className = 'breadcrumb-item is-current';
        span.setAttribute('aria-current', 'page');
        if (crumb.icon) span.insertAdjacentHTML('afterbegin', crumb.icon + ' ');
        const textSpan = document.createElement('span');
        textSpan.textContent = crumb.label;
        span.appendChild(textSpan);
        nav.appendChild(span);
      } else {
        const a = document.createElement('a');
        a.className = 'breadcrumb-item';
        a.href = crumb.href;
        if (crumb.icon) a.insertAdjacentHTML('afterbegin', crumb.icon + ' ');
        const textSpan = document.createElement('span');
        textSpan.textContent = crumb.label;
        a.appendChild(textSpan);
        nav.appendChild(a);
      }
    });

    if (isAdminPage) {
      const adminMain = document.querySelector('.layout > main, .layout > .main, .layout > .category-page, .layout > .category-form-page, .layout > .panel');
      if (adminMain) {
        adminMain.prepend(nav);
        return;
      }
    }

    const contentContainer = document.querySelector('main.content, main.account-shell, main.page-shell, main.container, main.panel, main');
    if (contentContainer) {
      contentContainer.prepend(nav);
    } else {
      const header = document.querySelector('header');
      if (header) header.after(nav);
      else document.body.prepend(nav);
    }
  };

  buildBreadcrumbs();

  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.layout > .sidebar a:not(.brand)[href^="/admin"]').forEach((link) => {
    const targetPath = link.getAttribute('href');
    if (currentPath === targetPath || (targetPath !== '/admin' && currentPath.startsWith(`${targetPath}/`))) {
      link.setAttribute('aria-current', 'page');
    }
  });
  document.querySelectorAll('.site-header nav > a').forEach((link) => {
    const targetPath = link.getAttribute('href');
    if (targetPath === currentPath || (targetPath !== '/' && currentPath.startsWith(`${targetPath}/`))) {
      link.setAttribute('aria-current', 'page');
    }
  });

  const loader = document.createElement('div');
  loader.id = 'page-loader';
  loader.innerHTML = '<span class="loading-spinner" aria-label="Loading"></span>';
  document.body.appendChild(loader);

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      form.setAttribute('aria-busy', 'true');
      const button = form.querySelector('button[type="submit"], button:not([type])');
      if (button) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<span class="loading-spinner"></span>Processing...';
      }
    });
  });

  document.querySelectorAll('a:not([target]):not([href^="#"])').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      loader.classList.add('is-visible');
    });
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!reducedMotion && finePointer) {
    document.querySelectorAll('[data-parallax-image]').forEach((image) => {
      const area = image.closest('[data-parallax-area]');
      if (!area) return;

      area.addEventListener('pointermove', (event) => {
        const bounds = area.getBoundingClientRect();
        const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
        const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;

        image.style.setProperty('--parallax-x', `${horizontal * 12}px`);
        image.style.setProperty('--parallax-y', `${vertical * 12}px`);
      });

      area.addEventListener('pointerleave', () => {
        image.style.setProperty('--parallax-x', '0px');
        image.style.setProperty('--parallax-y', '0px');
      });
    });
  }

  document.querySelectorAll('[data-product-variants]').forEach((selector) => {
    let variants;
    try {
      variants = JSON.parse(selector.dataset.productVariants || '[]');
    } catch (error) {
      console.error('Invalid product variant data:', error);
      return;
    }
    if (!Array.isArray(variants) || variants.length === 0) return;

    const colorButtons = Array.from(selector.querySelectorAll('[data-color-index]'));
    const optionContainer = selector.querySelector('#product-variant-options');
    const stockBadge = document.getElementById('product-stock');
    const cartLink = document.getElementById('continue-to-cart');
    const addToCartForm = document.getElementById('add-to-cart-form');
    const addToCartButton = document.getElementById('add-to-cart-button');
    const cartQuantity = document.getElementById('cart-quantity');
    const selectedColorName = selector.querySelector('#selected-color-name');
    const selectedVariantName = selector.querySelector('#selected-variant-name');
    const priceBlock = document.getElementById('product-price-block');
    const currentPrice = document.getElementById('current-price');
    const originalPrice = document.getElementById('original-price');
    const priceBadge = document.getElementById('price-badge');
    const couponSavings = document.getElementById('coupon-savings');
    let selectedColorIndex = 0;
    let selectedOptionIndex = 0;

    const updateSelection = () => {
      const color = variants[selectedColorIndex];
      if (!color || !Array.isArray(color.options) || color.options.length === 0) return;

      const images = Array.isArray(color.images) ? color.images : [];
      const gallery = document.querySelector('[data-swipe-gallery]');
      if (gallery && typeof gallery.refreshImages === 'function' && images.length) {
        gallery.refreshImages(images);
      }

      const selectedOption = color.options[selectedOptionIndex] || color.options[0];
      selectedOptionIndex = color.options.indexOf(selectedOption);
      optionContainer.querySelectorAll('[data-option-index]').forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === selectedOptionIndex));
        const option = color.options[index];
        const stock = Number(option.stock);
        const stockLabel = button.querySelector('.variant-option-stock');
        if (stockLabel) {
          stockLabel.classList.toggle('sold-out', !Number.isFinite(stock) || stock <= 0);
          stockLabel.classList.toggle('low', Number.isFinite(stock) && stock > 0 && stock < 10);
          stockLabel.textContent = !Number.isFinite(stock) || stock <= 0
            ? 'Out of stock'
            : `Stock: ${stock}`;
        }
      });
      if (selectedColorName) selectedColorName.textContent = color.color;
      if (selectedVariantName) selectedVariantName.textContent = selectedOption.label;

      const price = Number(selectedOption.price);
      if (Number.isFinite(price) && price >= 0 && priceBlock && currentPrice) {
        const couponApplied = priceBlock.dataset.couponApplied === 'true';
        const couponValue = Number(priceBlock.dataset.couponValue) || 0;
        const couponAmount = priceBlock.dataset.couponType === 'percentage'
          ? price * couponValue / 100
          : Math.min(price, couponValue);
        const displayPrice = Math.max(0, price - (couponApplied ? couponAmount : 0));
        currentPrice.textContent = `₹${displayPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const discountPercentage = Number(priceBlock.dataset.discountPercentage);
        const fixedOriginalPrice = Number(priceBlock.dataset.fixedOriginalPrice);
        const baseProductPrice = Number(priceBlock.dataset.baseProductPrice);
        const oldPrice = couponApplied
          ? price
          : (Number.isFinite(fixedOriginalPrice) && fixedOriginalPrice > baseProductPrice
            ? fixedOriginalPrice
            : (Number.isFinite(discountPercentage) && discountPercentage > 0 && discountPercentage < 100
              ? price / (1 - discountPercentage / 100)
              : 0));
        const hasValidDiscount = Number.isFinite(oldPrice) && oldPrice > price && price > 0;
        const actualDiscount = hasValidDiscount
          ? Math.min(99, Math.max(0, Math.round((oldPrice - price) / oldPrice * 100)))
          : 0;
        if (originalPrice) {
          originalPrice.hidden = !(couponApplied || hasValidDiscount);
          originalPrice.textContent = couponApplied || hasValidDiscount
            ? `₹${(couponApplied ? price : oldPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '';
        }
        if (priceBadge) {
          priceBadge.hidden = !(couponApplied || hasValidDiscount);
          priceBadge.textContent = couponApplied
            ? 'Coupon applied'
            : (hasValidDiscount && actualDiscount > 0 ? `↓${actualDiscount}%` : '');
        }
        if (couponSavings) {
          couponSavings.textContent = couponAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }

      const stock = Number(selectedOption.stock);
      if (addToCartForm) {
        addToCartForm.elements.colorIndex.value = String(selectedColorIndex);
        addToCartForm.elements.optionIndex.value = String(selectedOptionIndex);
        const maximum = Math.max(0, Math.min(stock, Number(addToCartForm.dataset.maxPerCustomer) || 5));
        cartQuantity.max = String(maximum);
        if (Number(cartQuantity.value) > maximum) cartQuantity.value = String(Math.max(1, maximum));
        cartQuantity.disabled = maximum <= 0;
        addToCartButton.disabled = maximum <= 0;
        addToCartForm.hidden = maximum <= 0;
      }
      if (!stockBadge || stockBadge.classList.contains('unavailable')) return;

      stockBadge.classList.remove('sold-out', 'low');
      if (stock <= 0) {
        stockBadge.classList.add('sold-out');
        stockBadge.textContent = 'Sold out · Out of stock';
      } else if (stock <= 5) {
        stockBadge.classList.add('low');
        stockBadge.textContent = `Only ${stock} left in stock`;
      } else {
        stockBadge.textContent = `${stock} in stock`;
      }
      if (cartLink) cartLink.hidden = stock <= 0;
    };

    const updateOptions = () => {
      const color = variants[selectedColorIndex];
      if (!color || !Array.isArray(color.options) || color.options.length === 0) return;
      optionContainer.replaceChildren();
      color.options.forEach((option, index) => {
        const element = document.createElement('button');
        element.className = 'variant-option';
        element.type = 'button';
        element.dataset.optionIndex = String(index);
        element.setAttribute('aria-pressed', 'false');
        const name = document.createElement('span');
        name.className = 'variant-option-name';
        name.textContent = option.label;
        const stock = Number(option.stock);
        const stockLabel = document.createElement('span');
        stockLabel.className = 'variant-option-stock';
        stockLabel.classList.toggle('sold-out', !Number.isFinite(stock) || stock <= 0);
        stockLabel.classList.toggle('low', Number.isFinite(stock) && stock > 0 && stock < 10);
        stockLabel.textContent = !Number.isFinite(stock) || stock <= 0
          ? 'Out of stock'
          : `Stock: ${stock}`;
        const price = document.createElement('span');
        price.className = 'variant-option-price';
        price.textContent = `₹${Number(option.price).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        element.append(name, stockLabel, price);
        element.addEventListener('click', () => {
          selectedOptionIndex = index;
          updateSelection();
        });
        optionContainer.appendChild(element);
      });
      selectedOptionIndex = 0;
      updateSelection();
    };

    colorButtons.forEach((button) => {
      button.addEventListener('click', () => {
        selectedColorIndex = Number(button.dataset.colorIndex);
        selectedOptionIndex = 0;
        colorButtons.forEach((item) => {
          item.setAttribute('aria-pressed', String(item === button));
        });
        updateOptions();
      });
    });

    updateOptions();
  });

  document.querySelectorAll('[data-swipe-gallery]').forEach((gallery) => {
    const image = gallery.querySelector('[data-gallery-image]');
    let images;
    try {
      images = JSON.parse(gallery.dataset.imageList || '[]');
    } catch (error) {
      console.error('Invalid product image gallery data:', error);
      return;
    }
    if (!image || !Array.isArray(images) || images.length < 2) return;

    let activeIndex = Math.max(0, images.indexOf(image.getAttribute('src')));
    let pointerStart = null;
    let suppressClick = false;
    const indicator = document.createElement('span');
    indicator.className = 'gallery-indicator';
    indicator.setAttribute('aria-live', 'polite');
    gallery.appendChild(indicator);

    const showImage = (index) => {
      activeIndex = (index + images.length) % images.length;
      image.src = images[activeIndex];
      image.dataset.galleryIndex = String(activeIndex);
      indicator.textContent = `${activeIndex + 1} / ${images.length}`;

      gallery.querySelectorAll('.image-thumbnail').forEach((thumbnail, thumbnailIndex) => {
        const isActive = thumbnailIndex === activeIndex;
        thumbnail.classList.toggle('active', isActive);
        thumbnail.setAttribute('aria-pressed', String(isActive));
      });
    };

    gallery.refreshImages = (nextImages) => {
      if (!Array.isArray(nextImages) || nextImages.length === 0) {
        console.error('Cannot display an empty product image gallery.');
        return;
      }
      images = nextImages;
      gallery.dataset.imageList = JSON.stringify(images);

      const thumbnailContainer = gallery.parentElement.querySelector('.image-thumbnails');
      if (thumbnailContainer) {
        thumbnailContainer.replaceChildren();
        images.forEach((src, index) => {
          const thumbnail = document.createElement('button');
          thumbnail.className = `image-thumbnail${index === 0 ? ' active' : ''}`;
          thumbnail.type = 'button';
          thumbnail.dataset.image = src;
          thumbnail.setAttribute('aria-label', `View product image ${index + 1}`);
          thumbnail.setAttribute('aria-pressed', String(index === 0));
          const thumbnailImage = document.createElement('img');
          thumbnailImage.src = src;
          thumbnailImage.alt = '';
          thumbnail.appendChild(thumbnailImage);
          thumbnailContainer.appendChild(thumbnail);
        });
      }
      showImage(0);
    };

    showImage(activeIndex);

    gallery.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('.image-thumbnail')) return;
      pointerStart = { x: event.clientX, y: event.clientY };
    });

    gallery.addEventListener('pointerup', (event) => {
      if (!pointerStart) return;
      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      pointerStart = null;

      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
      showImage(activeIndex + (deltaX < 0 ? 1 : -1));
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 0);
    });

    gallery.addEventListener('pointercancel', () => { pointerStart = null; });
    gallery.addEventListener('click', (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }, true);

    gallery.parentElement.addEventListener('click', (event) => {
      const thumbnail = event.target.closest('.image-thumbnail');
      if (!thumbnail || !gallery.parentElement.contains(thumbnail)) return;
      const index = Array.from(gallery.parentElement.querySelectorAll('.image-thumbnail')).indexOf(thumbnail);
      if (index >= 0) showImage(index);
    });
  });
})();
