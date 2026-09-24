(() => {
  const labels = {
    admin: 'Admin',
    cart: 'Cart',
    checkout: 'Checkout',
    'edit-profile': 'Edit profile',
    'forgot-password': 'Password reset',
    login: 'Login',
    orders: 'Orders',
    'order-success': 'Order confirmed',
    products: 'Products',
    profile: 'Profile',
    register: 'Register',
    settings: 'Settings',
    users: 'Users',
    wishlist: 'Wishlist',
    'product-details': 'Product details',
    new: 'New product'
  };
  const segments = window.location.pathname.split('/').filter(Boolean);
  const visibleSegments = segments.filter((segment) => !/^(\d+|SHP-\d+)$/i.test(segment));
  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'breadcrumb';
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  breadcrumb.innerHTML = '<a href="/">Shoply</a><span aria-hidden="true">/</span>';

  if (segments.length === 0) {
    breadcrumb.innerHTML += '<span aria-current="page">Home</span>';
  } else {
    visibleSegments.forEach((segment, index) => {
      const label = labels[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const isCurrent = index === visibleSegments.length - 1;
      const href = `/${segments.slice(0, segments.indexOf(segment) + 1).join('/')}`;
      breadcrumb.innerHTML += isCurrent
        ? `<span aria-current="page">${label}</span>`
        : `<a href="${href}">${label}</a><span aria-hidden="true">/</span>`;
    });
  }
  document.body.prepend(breadcrumb);

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
})();
