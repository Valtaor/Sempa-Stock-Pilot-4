(function ($) {
    'use strict';

    let productsLoaded = false;
    let movementsLoaded = false;

    const $views = $('.main-view');
    const $dashboard = $('#view-dashboard');

    if ($views.length) {
        $views.hide();
        if ($dashboard.length) {
            $dashboard.show();
        } else {
            $views.first().show();
        }
    }

    const $navigation = $('.menu-navigation');
    if ($navigation.length) {
        const $links = $navigation.find('a[data-view]');

        const showView = (rawView) => {
            let view = rawView;
            let $target = view ? $views.filter(`#view-${view}`) : $();

            $views.hide();

            if (!$target.length && $views.length) {
                $target = $views.first();
                const fallbackId = $target.attr('id') || '';
                const fallbackView = fallbackId.replace(/^view-/, '');
                if (fallbackView) {
                    view = fallbackView;
                }
            }

            if ($target.length) {
                $target.show();
            }

            $links.removeClass('active');
            if (view) {
                $links.filter(`[data-view="${view}"]`).addClass('active');

                if (view === 'products' && typeof loadProducts === 'function' && !productsLoaded) {
                    loadProducts().catch(showError);
                }

                if (view === 'movements' && typeof loadMovements === 'function' && !movementsLoaded) {
                    loadMovements().catch(showError);
                }
            }
        };

        const initialView = ($links.filter('.active').data('view') || 'dashboard');
        showView(initialView);

        $links.on('click', function (event) {
            event.preventDefault();
            const view = $(this).data('view');
            if (!view) {
                return;
            }
            showView(view);
        });
    }

    if (typeof SempaStocksData === 'undefined') {
        return;
    }

    const state = {
        products: [],
        movements: [],
        categories: [],
        suppliers: [],
        currentPage: 1,
        itemsPerPage: 50,
    };

    const selectors = {
        wrapper: '.sempa-stocks-wrapper',
        dashboardCards: '[data-dashboard]'
    };

    const $wrapper = document.querySelector(selectors.wrapper);
    if (!$wrapper) {
        return;
    }

    const productTable = document.querySelector('#stocks-products-table tbody');
    const movementTable = document.querySelector('#stocks-movements-table tbody');
    const alertsList = document.querySelector('#stocks-alerts');
    const recentList = document.querySelector('#stocks-recent');
    const productPanel = document.querySelector('#stocks-product-panel');
    const productForm = document.querySelector('#stock-product-form');
    const movementPanel = document.querySelector('#stocks-movement-panel');
    const movementForm = document.querySelector('#stock-movement-form');
    const searchInput = document.querySelector('#stocks-search');
    const productMeta = document.querySelector('#stocks-product-meta');
    const filterCategory = document.querySelector('#stocks-filter-category');
    const filterSupplier = document.querySelector('#stocks-filter-supplier');
    const filterStatus = document.querySelector('#stocks-filter-status');
    const clearFiltersButton = document.querySelector('#stocks-clear-filters');
    const perPageSelect = document.querySelector('#products-per-page');
    const prevPageButton = document.querySelector('#products-prev-page');
    const nextPageButton = document.querySelector('#products-next-page');
    const pageInfo = document.querySelector('#products-page-info');
    const countInfo = document.querySelector('#products-count-info');

    const exports = document.querySelectorAll('[data-trigger="export"], #stocks-export');
    exports.forEach((element) => {
        element.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = SempaStocksData.exportUrl;
        });
    });

    const refreshButton = document.querySelector('#stocks-refresh');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            loadAll({ force: true }).catch(showError);
        });
    }

    document.querySelector('#stocks-open-product-form')?.addEventListener('click', () => {
        openProductForm();
    });

    document.querySelector('#stocks-cancel-product')?.addEventListener('click', () => {
        resetProductForm();
        hidePanel(productPanel);
    });

    document.querySelectorAll('[data-dismiss="product"]').forEach((button) => {
        button.addEventListener('click', () => {
            resetProductForm();
            hidePanel(productPanel);
        });
    });

    document.querySelector('#stocks-open-movement-form')?.addEventListener('click', () => {
        openMovementForm();
    });

    document.querySelector('#stocks-cancel-movement')?.addEventListener('click', () => {
        movementForm?.reset();
        hidePanel(movementPanel);
    });

    document.querySelectorAll('[data-dismiss="movement"]').forEach((button) => {
        button.addEventListener('click', () => {
            movementForm?.reset();
            hidePanel(movementPanel);
        });
    });

    if (productForm) {
        productForm.addEventListener('submit', (event) => {
            event.preventDefault();
            saveProduct(new FormData(productForm));
        });

        productForm.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            const action = target.dataset.action;
            if (!action) {
                return;
            }
            event.preventDefault();
            if (action === 'add-category') {
                createCategory();
            } else if (action === 'add-supplier') {
                createSupplier();
            }
        });
    }

    if (movementForm) {
        movementForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(movementForm);
            formData.set('quantite', Math.abs(parseInt(formData.get('quantite'), 10) || 0));
            request('sempa_stocks_record_movement', formData)
                .then((response) => {
                    if (response?.success && response.data?.movement) {
                        state.movements.unshift(response.data.movement);
                        renderMovements();
                        const product = state.products.find((item) => item.id === response.data.movement.produit_id);
                        if (product) {
                            product.stock_actuel = response.data.movement.nouveau_stock;
                            renderProducts();
                        }
                        movementForm.reset();
                        hidePanel(movementPanel);
                    }
                })
                .catch(showError);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            state.currentPage = 1;
            renderProducts(searchInput.value);
        });
    }

    filterCategory?.addEventListener('change', () => {
        state.currentPage = 1;
        renderProducts(searchInput?.value || '');
    });

    filterSupplier?.addEventListener('change', () => {
        state.currentPage = 1;
        renderProducts(searchInput?.value || '');
    });

    filterStatus?.addEventListener('change', () => {
        state.currentPage = 1;
        renderProducts(searchInput?.value || '');
    });

    clearFiltersButton?.addEventListener('click', () => {
        if (filterCategory) {
            filterCategory.value = '';
        }
        if (filterSupplier) {
            filterSupplier.value = '';
        }
        if (filterStatus) {
            filterStatus.value = '';
        }
        state.currentPage = 1;
        renderProducts(searchInput?.value || '');
    });

    perPageSelect?.addEventListener('change', () => {
        const value = perPageSelect.value;
        state.itemsPerPage = value === 'all' ? Infinity : parseInt(value, 10);
        state.currentPage = 1;
        renderProducts(searchInput?.value || '');
    });

    prevPageButton?.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderProducts(searchInput?.value || '');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    nextPageButton?.addEventListener('click', () => {
        state.currentPage++;
        renderProducts(searchInput?.value || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function loadDashboard() {
        return request('sempa_stocks_dashboard').then((response) => {
            if (response?.success) {
                renderDashboard(response.data);
            }
            return response;
        });
    }

    function loadReferenceData() {
        return request('sempa_stocks_reference_data').then((response) => {
            if (response?.success) {
                state.categories = response.data.categories || [];
                state.suppliers = response.data.suppliers || [];
                populateSelects();
            }
            return response;
        });
    }

    function loadProducts(options = {}) {
        const config = typeof options === 'boolean' ? { force: options } : options;
        const force = Boolean(config?.force);

        if (productsLoaded && !force) {
            return Promise.resolve();
        }

        return request('sempa_stocks_products')
            .then((response) => {
                if (response?.success) {
                    state.products = response.data.products || [];
                    renderProducts();
                    updateMovementSelect();
                    productsLoaded = true;
                }
                return response;
            })
            .catch((error) => {
                productsLoaded = false;
                throw error;
            });
    }

    function loadMovements(options = {}) {
        const config = typeof options === 'boolean' ? { force: options } : options;
        const force = Boolean(config?.force);

        if (movementsLoaded && !force) {
            return Promise.resolve();
        }

        return request('sempa_stocks_movements')
            .then((response) => {
                if (response?.success) {
                    state.movements = response.data.movements || [];
                    renderMovements();
                    movementsLoaded = true;
                }
                return response;
            })
            .catch((error) => {
                movementsLoaded = false;
                throw error;
            });
    }

    function loadAll(options = {}) {
        const config = typeof options === 'boolean' ? { force: options } : options;
        const force = Boolean(config?.force);

        if (force) {
            productsLoaded = false;
            movementsLoaded = false;
        }

        return Promise.all([
            loadDashboard(),
            loadProducts({ force }),
            loadMovements({ force }),
            loadReferenceData()
        ]);
    }

    function request(action, formData) {
        const data = formData instanceof FormData ? formData : new FormData();
        if (!(formData instanceof FormData)) {
            Object.entries(formData || {}).forEach(([key, value]) => {
                data.append(key, value);
            });
        }
        if (typeof data.set === 'function') {
            data.set('action', action);
            data.set('nonce', SempaStocksData.nonce);
        } else {
            data.append('action', action);
            data.append('nonce', SempaStocksData.nonce);
        }

        return fetch(SempaStocksData.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            body: data,
        }).then((response) => response.json());
    }

    function renderDashboard(data) {
        if (!data) {
            return;
        }

        const totals = data.totals || {};
        setMetricValue(document.querySelector('[data-dashboard="produits"]'), (totals.produits ?? 0).toString());
        setMetricValue(document.querySelector('[data-dashboard="valeur"]'), formatCurrency(totals.valeur));

        const alerts = Array.isArray(data.alerts) ? data.alerts : [];
        const recent = Array.isArray(data.recent) ? data.recent : [];
        const noAlertsText = SempaStocksData?.strings?.noAlerts || 'Aucune alerte critique';
        const noRecentText = SempaStocksData?.strings?.noRecent || 'Aucun mouvement récent';

        setMetricValue(document.querySelector('[data-dashboard="alertes"]'), alerts.length.toString());
        setMetricValue(document.querySelector('[data-dashboard="mouvements"]'), recent.length.toString());

        if (alertsList) {
            alertsList.innerHTML = '';
            if (!alerts.length) {
                alertsList.innerHTML = `<li class="empty">${escapeHtml(noAlertsText)}</li>`;
            } else {
                alerts.forEach((alert) => {
                    const status = stockStatus(alert.stock_actuel, alert.stock_minimum);
                    const current = Number(alert.stock_actuel ?? 0);
                    const minimum = Number(alert.stock_minimum ?? 0);
                    const severity = status === 'critical' ? 'urgent' : status === 'warning' ? 'warning' : 'normal';
                    const severityLabel = status === 'critical' ? 'URGENT' : status === 'warning' ? 'AVERTISSEMENT' : 'INFO';
                    const li = document.createElement('li');
                    li.className = `alerts-item alerts-item--${status}`;
                    li.innerHTML = `
                        <span class="alerts-item__severity alerts-item__severity--${severity}">${escapeHtml(severityLabel)}</span>
                        <div class="alerts-item__body">
                            <div class="alerts-item__title">
                                <strong>${escapeHtml(alert.reference)}</strong>
                                <span class="alerts-item__designation">${escapeHtml(alert.designation)}</span>
                            </div>
                            <div class="alerts-item__meta">
                                <span class="status-badge status-badge--${statusClassName(status)}">${escapeHtml(statusLabel(status))}</span>
                                <span class="alerts-item__count">${current} / ${minimum}</span>
                            </div>
                        </div>`;
                    alertsList.appendChild(li);
                });
            }
        }

        if (recentList) {
            recentList.innerHTML = '';
            if (!recent.length) {
                recentList.innerHTML = `<li class="empty">${escapeHtml(noRecentText)}</li>`;
            } else {
                recent.forEach((movement) => {
                    const tone = movementTone(movement.type_mouvement);
                    const label = labelMovement(movement.type_mouvement);
                    const quantity = movement.quantite ?? 0;
                    const li = document.createElement('li');
                    li.className = 'recent-item';
                    li.dataset.type = tone;
                    li.innerHTML = `
                        <div class="recent-item__marker" aria-hidden="true"></div>
                        <div class="recent-item__content">
                            <div class="recent-item__header">
                                <span class="recent-item__title">${escapeHtml(movement.reference)} – ${escapeHtml(movement.designation)}</span>
                                <time class="recent-item__date" datetime="${escapeAttribute(movement.date_mouvement || '')}">${escapeHtml(formatRelativeDate(movement.date_mouvement))}</time>
                            </div>
                            <div class="recent-item__meta">
                                <span class="movement-chip movement-chip--${tone}">${escapeHtml(label)}</span>
                                <span class="recent-item__quantity">${escapeHtml(String(quantity))}</span>
                            </div>
                        </div>`;
                    recentList.appendChild(li);
                });
            }
        }
    }

    function updatePaginationControls(totalProducts, displayedProducts) {
        if (!pageInfo || !prevPageButton || !nextPageButton || !countInfo) {
            return;
        }

        const totalPages = state.itemsPerPage === Infinity ? 1 : Math.ceil(totalProducts / state.itemsPerPage);

        // Update page info
        if (state.itemsPerPage === Infinity) {
            pageInfo.textContent = `${totalProducts} produit${totalProducts > 1 ? 's' : ''}`;
        } else {
            pageInfo.textContent = `Page ${state.currentPage} sur ${totalPages}`;
        }

        // Update count info
        if (state.itemsPerPage === Infinity) {
            countInfo.textContent = 'Tous les produits affichés';
        } else {
            const start = (state.currentPage - 1) * state.itemsPerPage + 1;
            const end = Math.min(state.currentPage * state.itemsPerPage, totalProducts);
            countInfo.textContent = `Affichage de ${start}-${end} sur ${totalProducts} produit${totalProducts > 1 ? 's' : ''}`;
        }

        // Enable/disable buttons
        prevPageButton.disabled = state.currentPage <= 1;
        nextPageButton.disabled = state.currentPage >= totalPages;
    }

    function renderProducts(search = '') {
        if (!productTable) {
            return;
        }

        const searchValue = (typeof search === 'string' && search.length >= 0 ? search : '') || (searchInput?.value || '');
        const query = searchValue.trim().toLowerCase();
        const categoryFilter = filterCategory?.value?.toLowerCase() || '';
        const supplierFilter = filterSupplier?.value?.toLowerCase() || '';
        const statusFilter = filterStatus?.value || '';

        const filteredProducts = state.products
            .filter((product) => {
                if (!query) {
                    return true;
                }
                return (
                    (product.reference || '').toLowerCase().includes(query) ||
                    (product.designation || '').toLowerCase().includes(query)
                );
            })
            .filter((product) => {
                const productCategory = (product.categorie || '').toLowerCase();
                const productSupplier = (product.fournisseur || '').toLowerCase();
                const status = stockStatus(product.stock_actuel, product.stock_minimum);

                if (categoryFilter && productCategory !== categoryFilter) {
                    return false;
                }
                if (supplierFilter && productSupplier !== supplierFilter) {
                    return false;
                }
                if (statusFilter && status !== statusFilter) {
                    return false;
                }

                return true;
            });

        const totalProducts = filteredProducts.length;

        // Reset to page 1 if current page is beyond available pages
        const totalPages = state.itemsPerPage === Infinity ? 1 : Math.ceil(totalProducts / state.itemsPerPage);
        if (state.currentPage > totalPages && totalPages > 0) {
            state.currentPage = totalPages;
        }
        if (state.currentPage < 1) {
            state.currentPage = 1;
        }

        // Slice products for current page
        const startIndex = state.itemsPerPage === Infinity ? 0 : (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = state.itemsPerPage === Infinity ? totalProducts : startIndex + state.itemsPerPage;
        const productsToDisplay = filteredProducts.slice(startIndex, endIndex);

        const rows = productsToDisplay
            .map((product) => {
                const documentUrl = product.document_pdf
                    ? (product.document_pdf.startsWith('http')
                        ? product.document_pdf
                        : SempaStocksData.uploadsUrl + product.document_pdf.replace(/^uploads-stocks\//, ''))
                    : '';
                const stockActual = Number(product.stock_actuel ?? 0);
                const stockMinimum = Number(product.stock_minimum ?? 0);
                const status = stockStatus(stockActual, stockMinimum);
                const value = formatCurrency((Number(product.prix_achat) || 0) * stockActual);
                const meta = [product.categorie, product.fournisseur].filter(Boolean).join(' • ');
                const tr = document.createElement('tr');
                tr.dataset.id = product.id;
                tr.dataset.status = status;
                tr.innerHTML = `
                    <td>
                        <div class="product-cell">
                            <span class="product-cell__name">${escapeHtml(product.designation)}</span>
                            <span class="product-cell__meta">${escapeHtml(meta || '—')}</span>
                        </div>
                    </td>
                    <td>
                        <div class="product-ref">
                            <span class="product-ref__code">${escapeHtml(product.reference)}</span>
                            ${documentUrl ? `<a class="product-ref__doc" href="${escapeAttribute(documentUrl)}" target="_blank" rel="noopener">PDF</a>` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="stock-level">
                            <span class="stock-level__value">${stockActual}</span>
                            <span class="stock-level__hint">${escapeHtml(`Min ${stockMinimum}`)}</span>
                            <span class="stock-level__value-secondary">${escapeHtml(value)}</span>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge status-badge--${statusClassName(status)}">${escapeHtml(statusLabel(status))}</span>
                    </td>
                    <td class="actions">
                        <details class="actions-menu">
                            <summary class="actions-trigger" aria-label="${escapeAttribute(SempaStocksData?.strings?.productActions || 'Actions produit')}"><span aria-hidden="true">⋮</span></summary>
                            <div class="actions-menu__content">
                                <button type="button" data-action="edit">${escapeHtml('Modifier')}</button>
                                <button type="button" data-action="delete">${escapeHtml('Supprimer')}</button>
                            </div>
                        </details>
                    </td>`;
                return tr;
            });

        productTable.innerHTML = '';
        if (!rows.length) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="5" class="empty">${escapeHtml(SempaStocksData?.strings?.noProducts || 'Aucun produit trouvé')}</td>`;
            productTable.appendChild(row);
        } else {
            rows.forEach((row) => productTable.appendChild(row));
        }

        // Update pagination controls
        updatePaginationControls(totalProducts, productsToDisplay.length);
    }

    function renderMovements() {
        if (!movementTable) {
            return;
        }

        movementTable.innerHTML = '';
        if (!state.movements.length) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" class="empty">${escapeHtml(SempaStocksData?.strings?.noMovements || 'Aucun mouvement enregistré')}</td>`;
            movementTable.appendChild(row);
            return;
        }

        state.movements.forEach((movement) => {
            const tr = document.createElement('tr');
            const tone = movementTone(movement.type_mouvement);
            const label = labelMovement(movement.type_mouvement);
            const quantity = movement.quantite ?? 0;
            tr.dataset.type = tone;
            tr.innerHTML = `
                <td>${escapeHtml(formatDate(movement.date_mouvement))}</td>
                <td>${escapeHtml(movement.reference)} – ${escapeHtml(movement.designation)}</td>
                <td><span class="movement-chip movement-chip--${tone}">${escapeHtml(label)}</span></td>
                <td><span class="movement-qty">${escapeHtml(String(quantity))}</span></td>
                <td>${movement.ancien_stock ?? 0} ➜ ${movement.nouveau_stock ?? 0}</td>
                <td>${escapeHtml(movement.motif || '')}</td>`;
            movementTable.appendChild(tr);
        });
    }

    function populateSelects() {
        const categorySelect = document.querySelector('#stocks-category-select');
        const supplierSelect = document.querySelector('#stocks-supplier-select');
        const movementSelect = document.querySelector('#movement-product');

        if (categorySelect) {
            const current = categorySelect.value;
            categorySelect.innerHTML = '<option value="">—</option>';
            state.categories.forEach((category) => {
                const option = document.createElement('option');
                option.value = category.nom;
                option.textContent = category.nom;
                categorySelect.appendChild(option);
            });
            if (current) {
                categorySelect.value = current;
            }
        }

        if (supplierSelect) {
            const currentSupplier = supplierSelect.value;
            supplierSelect.innerHTML = '<option value="">—</option>';
            state.suppliers.forEach((supplier) => {
                const option = document.createElement('option');
                option.value = supplier.nom;
                option.textContent = supplier.nom;
                supplierSelect.appendChild(option);
            });
            if (currentSupplier) {
                supplierSelect.value = currentSupplier;
            }
        }

        if (filterCategory) {
            const currentFilter = filterCategory.value;
            filterCategory.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = (SempaStocksData?.strings?.allCategories) || 'Toutes les catégories';
            filterCategory.appendChild(placeholder);
            state.categories.forEach((category) => {
                const option = document.createElement('option');
                option.value = (category.nom || '').toLowerCase();
                option.textContent = category.nom;
                filterCategory.appendChild(option);
            });
            if (currentFilter) {
                filterCategory.value = currentFilter;
            }
        }

        if (filterSupplier) {
            const currentFilter = filterSupplier.value;
            filterSupplier.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = (SempaStocksData?.strings?.allSuppliers) || 'Tous les fournisseurs';
            filterSupplier.appendChild(placeholder);
            state.suppliers.forEach((supplier) => {
                const option = document.createElement('option');
                option.value = (supplier.nom || '').toLowerCase();
                option.textContent = supplier.nom;
                filterSupplier.appendChild(option);
            });
            if (currentFilter) {
                filterSupplier.value = currentFilter;
            }
        }

        if (movementSelect) {
            updateMovementSelect();
        }
    }

    function updateMovementSelect() {
        const movementSelect = document.querySelector('#movement-product');
        if (!movementSelect) {
            return;
        }
        movementSelect.innerHTML = '';
        state.products.forEach((product) => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.reference} – ${product.designation}`;
            movementSelect.appendChild(option);
        });
    }

    function openMovementForm() {
        if (movementForm) {
            movementForm.reset();
        }
        updateMovementSelect();
        showPanel(movementPanel);
    }

    function openProductForm(product = null) {
        productForm?.reset();
        if (!productForm) {
            return;
        }
        if (product) {
            productForm.querySelector('[name="id"]').value = product.id || '';
            productForm.querySelector('[name="reference"]').value = product.reference || '';
            productForm.querySelector('[name="designation"]').value = product.designation || '';
            productForm.querySelector('[name="categorie"]').value = product.categorie || '';
            productForm.querySelector('[name="fournisseur"]').value = product.fournisseur || '';
            productForm.querySelector('[name="etat_materiel"]').value = product.etat_materiel || 'neuf';
            productForm.querySelector('[name="prix_achat"]').value = product.prix_achat || '';
            productForm.querySelector('[name="prix_vente"]').value = product.prix_vente || '';
            productForm.querySelector('[name="stock_actuel"]').value = product.stock_actuel || 0;
            productForm.querySelector('[name="stock_minimum"]').value = product.stock_minimum || 0;
            productForm.querySelector('[name="stock_maximum"]').value = product.stock_maximum || 0;
            productForm.querySelector('[name="emplacement"]').value = product.emplacement || '';
            productForm.querySelector('[name="date_entree"]').value = product.date_entree || '';
            productForm.querySelector('[name="notes"]').value = product.notes || '';
            renderMeta(product);
        } else if (productMeta) {
            productMeta.innerHTML = '';
        }
        showPanel(productPanel);
    }

    function resetProductForm() {
        if (productForm) {
            productForm.reset();
            productForm.querySelector('[name="id"]').value = '';
        }
        if (productMeta) {
            productMeta.innerHTML = '';
        }
    }

    function saveProduct(formData) {
        request('sempa_stocks_save_product', formData)
            .then((response) => {
                if (response?.success && response.data?.product) {
                    const product = response.data.product;
                    const index = state.products.findIndex((item) => item.id === product.id);
                    if (index >= 0) {
                        state.products[index] = product;
                    } else {
                        state.products.push(product);
                    }
                    renderProducts(searchInput?.value || '');
                    updateMovementSelect();
                    hidePanel(productPanel);
                    resetProductForm();
                } else {
                    throw new Error(response?.data?.message || SempaStocksData.strings.unknownError);
                }
            })
            .catch(showError);
    }

    function showPanel(panel) {
        if (!panel) {
            return;
        }
        panel.removeAttribute('hidden');
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function hidePanel(panel) {
        panel?.setAttribute('hidden', 'hidden');
    }

    function renderMeta(product) {
        if (!productMeta) {
            return;
        }
        const documentUrl = product.document_pdf
            ? (product.document_pdf.startsWith('http')
                ? product.document_pdf
                : SempaStocksData.uploadsUrl + product.document_pdf.replace(/^uploads-stocks\//, ''))
            : '';
        productMeta.innerHTML = `
            <ul>
                <li><strong>${escapeHtml('Créé par')} :</strong> ${escapeHtml(product.ajoute_par || '—')}</li>
                <li><strong>${escapeHtml('Entrée')} :</strong> ${product.date_entree || '—'}</li>
                <li><strong>${escapeHtml('Modifié')} :</strong> ${product.date_modification || '—'}</li>
                ${documentUrl ? `<li><a href="${escapeAttribute(documentUrl)}" target="_blank" rel="noopener">${escapeHtml('Voir le document')}</a></li>` : ''}
            </ul>`;
    }

    function createCategory() {
        const name = window.prompt('Nom de la nouvelle catégorie ?');
        if (!name) {
            return;
        }
        const color = window.prompt('Couleur hexadécimale (#f4a412 par défaut)', '#f4a412') || '#f4a412';
        const data = new FormData();
        data.append('nom', name.trim());
        data.append('couleur', color.trim());
        request('sempa_stocks_save_category', data)
            .then((response) => {
                if (response?.success && response.data?.category) {
                    state.categories.push(response.data.category);
                    populateSelects();
                    const select = document.querySelector('#stocks-category-select');
                    if (select) {
                        select.value = response.data.category.nom;
                    }
                } else {
                    throw new Error(response?.data?.message || SempaStocksData.strings.unknownError);
                }
            })
            .catch(showError);
    }

    function createSupplier() {
        const name = window.prompt('Nom du fournisseur ?');
        if (!name) {
            return;
        }
        const contact = window.prompt('Nom du contact (optionnel)') || '';
        const phone = window.prompt('Téléphone (optionnel)') || '';
        const email = window.prompt('Email (optionnel)') || '';
        const data = new FormData();
        data.append('nom', name.trim());
        data.append('contact', contact.trim());
        data.append('telephone', phone.trim());
        data.append('email', email.trim());
        request('sempa_stocks_save_supplier', data)
            .then((response) => {
                if (response?.success && response.data?.supplier) {
                    state.suppliers.push(response.data.supplier);
                    populateSelects();
                    const select = document.querySelector('#stocks-supplier-select');
                    if (select) {
                        select.value = response.data.supplier.nom;
                    }
                } else {
                    throw new Error(response?.data?.message || SempaStocksData.strings.unknownError);
                }
            })
            .catch(showError);
    }

    function stockStatus(current, minimum) {
        const stock = Number(current ?? 0);
        const min = Number(minimum ?? 0);
        if (stock <= 0) {
            return 'critical';
        }
        if (min > 0 && stock <= min) {
            return 'warning';
        }
        return 'normal';
    }

    function statusLabel(status) {
        switch (status) {
            case 'critical':
                return 'Rupture';
            case 'warning':
                return 'Stock faible';
            default:
                return 'En stock';
        }
    }

    function statusClassName(status) {
        switch (status) {
            case 'critical':
                return 'out';
            case 'warning':
                return 'low';
            default:
                return 'in-stock';
        }
    }

    function movementTone(type) {
        switch (type) {
            case 'entree':
                return 'entry';
            case 'sortie':
                return 'exit';
            case 'ajustement':
                return 'adjust';
            default:
                return 'neutral';
        }
    }

    function setMetricValue(element, text) {
        if (!element) {
            return;
        }
        const value = text == null ? '' : String(text);
        if (element.textContent !== value) {
            element.textContent = value;
            element.classList.remove('is-updated');
            void element.offsetWidth;
            element.classList.add('is-updated');
        } else {
            element.textContent = value;
        }
    }

    function labelMovement(type) {
        switch (type) {
            case 'entree':
                return 'Entrée';
            case 'sortie':
                return 'Sortie';
            case 'ajustement':
                return 'Ajustement';
            default:
                return type || '';
        }
    }

    function formatDate(value) {
        if (!value) {
            return '';
        }
        const date = new Date(value.replace(' ', 'T'));
        return date.toLocaleString('fr-FR');
    }

    function formatRelativeDate(value) {
        if (!value) {
            return '';
        }
        const date = new Date(value.replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const now = new Date();
        const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
        const absSeconds = Math.abs(diffSeconds);
        const table = [
            { limit: 60, divisor: 1, unit: 'second' },
            { limit: 3600, divisor: 60, unit: 'minute' },
            { limit: 86400, divisor: 3600, unit: 'hour' },
            { limit: 604800, divisor: 86400, unit: 'day' },
            { limit: 2629800, divisor: 604800, unit: 'week' },
            { limit: 31557600, divisor: 2629800, unit: 'month' },
            { limit: Infinity, divisor: 31557600, unit: 'year' },
        ];

        for (const entry of table) {
            if (absSeconds < entry.limit) {
                const valueToFormat = Math.round(diffSeconds / entry.divisor);
                if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat !== 'undefined') {
                    const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
                    return rtf.format(valueToFormat, entry.unit);
                }
                const absoluteString = Math.abs(valueToFormat).toString();
                const suffix = diffSeconds < 0 ? 'il y a' : 'dans';
                return `${suffix} ${absoluteString} ${entry.unit}`;
            }
        }

        return formatDate(value);
    }

    function formatCurrency(value) {
        const amount = Number(value || 0);
        return amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    }

    function escapeHtml(value) {
        if (value == null) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/\s/g, '%20');
    }

    function showError(error) {
        const message = error?.message || SempaStocksData.strings.unknownError;
        window.alert(message);
    }

    productTable?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const action = target.dataset.action;
        if (!action) {
            return;
        }
        const row = target.closest('tr');
        const id = row ? parseInt(row.dataset.id, 10) : 0;
        const product = state.products.find((item) => item.id === id);
        if (!product) {
            return;
        }
        if (action === 'edit') {
            openProductForm(product);
        } else if (action === 'delete') {
            if (confirm('Supprimer ce produit ?')) {
                const payload = new FormData();
                payload.append('id', String(product.id));
                request('sempa_stocks_delete_product', payload)
                    .then((response) => {
                        if (response?.success) {
                            state.products = state.products.filter((item) => item.id !== product.id);
                            renderProducts(searchInput?.value || '');
                            updateMovementSelect();
                        } else {
                            throw new Error(response?.data?.message || SempaStocksData.strings.unknownError);
                        }
                    })
                    .catch(showError);
            }
        }
        const menu = target.closest('details');
        if (menu) {
            menu.open = false;
        }
    });

    Promise.all([
        loadDashboard(),
        loadReferenceData()
    ]).catch(showError);
})(jQuery);
