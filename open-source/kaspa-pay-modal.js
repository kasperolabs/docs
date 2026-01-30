/**
 * Kaspa Pay Modal - Open Source Edition
 * A simple, no-backend payment modal for Kaspa
 * 
 * Usage:
 *   <div id="kaspa-pay" 
 *        data-address="kaspa:qr..."
 *        data-amount="10"
 *        data-item="Coffee"
 *        data-theme="dark">
 *   </div>
 *   <script src="kaspa-pay-modal.js"></script>
 * 
 * Or trigger programmatically:
 *   KaspaPay.open({
 *     address: 'kaspa:qr...',
 *     amount: 10,
 *     item: 'Coffee',
 *     theme: 'dark',
 *     onSuccess: function(result) { console.log(result.txid); }
 *   });
 */

(function() {
    'use strict';

    var KaspaPay = {
        config: {
            address: null,
            amount: 0,
            item: 'Payment',
            theme: 'dark'
        },
        modal: null,
        pollInterval: null,
        processing: false
    };

    // =============================================
    // Wallet Detection
    // =============================================

    function detectWallets() {
        return {
            kasware: typeof window.kasware !== 'undefined',
            kastle: typeof window.kastle !== 'undefined'
        };
    }

    function isMobile() {
        return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    }

    // =============================================
    // QR Code Generation
    // =============================================

    function generateQR(data, size) {
        return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(data);
    }

    // =============================================
    // Styles
    // =============================================

    function injectStyles() {
        if (document.getElementById('kaspa-pay-styles')) return;

        var css = `
            .ksp-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s;
            }
            .ksp-overlay.open { 
                opacity: 1; 
                pointer-events: auto;
            }
            
            .ksp-modal {
                background: var(--ksp-bg);
                color: var(--ksp-text);
                border-radius: 16px;
                width: 90%;
                max-width: 400px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                transform: scale(0.9);
                transition: transform 0.2s;
            }
            .ksp-overlay.open .ksp-modal { transform: scale(1); }
            
            .ksp-modal.light {
                --ksp-bg: #ffffff;
                --ksp-text: #1a1a2e;
                --ksp-border: #e2e8f0;
                --ksp-muted: #64748b;
                --ksp-accent: #49eacb;
                --ksp-btn-bg: #1a1a2e;
                --ksp-btn-text: #ffffff;
            }
            .ksp-modal.dark {
                --ksp-bg: #1a1a2e;
                --ksp-text: #ffffff;
                --ksp-border: #2d2d44;
                --ksp-muted: #94a3b8;
                --ksp-accent: #49eacb;
                --ksp-btn-bg: #49eacb;
                --ksp-btn-text: #1a1a2e;
            }
            
            .ksp-header {
                padding: 20px;
                border-bottom: 1px solid var(--ksp-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .ksp-title {
                font-size: 18px;
                font-weight: 600;
                margin: 0;
                color: var(--ksp-text);
            }
            .ksp-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--ksp-muted);
                padding: 0;
                line-height: 1;
            }
            .ksp-close:hover { color: var(--ksp-text); }
            
            .ksp-body { padding: 20px; }
            
            .ksp-amount {
                text-align: center;
                margin-bottom: 20px;
            }
            .ksp-amount-value {
                font-size: 32px;
                font-weight: 700;
                color: var(--ksp-accent);
            }
            .ksp-amount-label {
                font-size: 14px;
                color: var(--ksp-muted);
                margin-top: 4px;
            }
            
            .ksp-wallets {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 20px;
            }
            .ksp-wallet-btn {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 16px;
                background: var(--ksp-bg);
                border: 1px solid var(--ksp-border);
                border-radius: 10px;
                cursor: pointer;
                transition: border-color 0.2s, background 0.2s;
            }
            .ksp-wallet-btn:hover {
                border-color: var(--ksp-accent);
                background: rgba(73, 234, 203, 0.05);
            }
            .ksp-wallet-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 14px;
            }
            .ksp-wallet-info { flex: 1; text-align: left; }
            .ksp-wallet-name { font-weight: 500; color: var(--ksp-text); }
            .ksp-wallet-desc { font-size: 12px; color: var(--ksp-muted); }
            
            .ksp-divider {
                text-align: center;
                color: var(--ksp-muted);
                font-size: 13px;
                margin: 20px 0;
                position: relative;
            }
            .ksp-divider::before,
            .ksp-divider::after {
                content: '';
                position: absolute;
                top: 50%;
                width: 40%;
                height: 1px;
                background: var(--ksp-border);
            }
            .ksp-divider::before { left: 0; }
            .ksp-divider::after { right: 0; }
            
            .ksp-qr-section { text-align: center; }
            .ksp-qr-img {
                width: 180px;
                height: 180px;
                border-radius: 12px;
                margin: 0 auto 16px;
            }
            .ksp-address-box {
                background: rgba(73, 234, 203, 0.1);
                border-radius: 8px;
                padding: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 12px;
            }
            .ksp-address {
                flex: 1;
                font-family: monospace;
                font-size: 11px;
                word-break: break-all;
                text-align: left;
                color: var(--ksp-text);
            }
            .ksp-copy-btn {
                background: var(--ksp-btn-bg);
                color: var(--ksp-btn-text);
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                white-space: nowrap;
            }
            .ksp-copy-btn:hover { opacity: 0.9; }
            
            .ksp-status {
                text-align: center;
                padding: 40px 20px;
            }
            .ksp-spinner {
                width: 48px;
                height: 48px;
                border: 3px solid var(--ksp-border);
                border-top-color: var(--ksp-accent);
                border-radius: 50%;
                animation: ksp-spin 1s linear infinite;
                margin: 0 auto 16px;
            }
            @keyframes ksp-spin {
                to { transform: rotate(360deg); }
            }
            .ksp-success-icon {
                width: 64px;
                height: 64px;
                background: var(--ksp-accent);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
                font-size: 32px;
                color: #1a1a2e;
            }
            .ksp-status-text {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--ksp-text);
            }
            .ksp-status-sub {
                font-size: 14px;
                color: var(--ksp-muted);
            }
            
            .ksp-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--ksp-border);
                text-align: center;
            }
            .ksp-footer a {
                color: var(--ksp-muted);
                font-size: 12px;
                text-decoration: none;
            }
            .ksp-footer a:hover { color: var(--ksp-accent); }
            
            .ksp-btn-primary {
                width: 100%;
                padding: 14px;
                background: var(--ksp-btn-bg);
                color: var(--ksp-btn-text);
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .ksp-btn-primary:hover { opacity: 0.9; }
        `;

        var style = document.createElement('style');
        style.id = 'kaspa-pay-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // =============================================
    // Modal HTML
    // =============================================

    function createModal() {
        var overlay = document.createElement('div');
        overlay.className = 'ksp-overlay';
        overlay.id = 'kaspa-pay-overlay';
        overlay.innerHTML = '<div class="ksp-modal ' + KaspaPay.config.theme + '" id="kaspa-pay-modal"></div>';
        
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) KaspaPay.close();
        });
        
        document.body.appendChild(overlay);
        KaspaPay.modal = overlay;
    }

    function renderWalletPicker() {
        var wallets = detectWallets();
        var mobile = isMobile();
        var amount = KaspaPay.config.amount;
        var item = KaspaPay.config.item;
        var address = KaspaPay.config.address;
        var kaspaUri = address + '?amount=' + amount;

        var walletsHtml = '';

        // Browser extension wallets (desktop only)
        if (!mobile) {
            if (wallets.kasware) {
                walletsHtml += `
                    <button class="ksp-wallet-btn" data-wallet="kasware">
                        <div class="ksp-wallet-icon" style="background:#6366f1;color:#fff;">K</div>
                        <div class="ksp-wallet-info">
                            <div class="ksp-wallet-name">Kasware</div>
                            <div class="ksp-wallet-desc">Browser extension</div>
                        </div>
                    </button>`;
            }
            if (wallets.kastle) {
                walletsHtml += `
                    <button class="ksp-wallet-btn" data-wallet="kastle">
                        <div class="ksp-wallet-icon" style="background:#10b981;color:#fff;">K</div>
                        <div class="ksp-wallet-info">
                            <div class="ksp-wallet-name">Kastle</div>
                            <div class="ksp-wallet-desc">Browser extension</div>
                        </div>
                    </button>`;
            }
        }

        // Mobile wallet (URI based)
        if (mobile) {
            walletsHtml += `
                <a href="${kaspaUri}" class="ksp-wallet-btn" style="text-decoration:none;color:inherit;">
                    <div class="ksp-wallet-icon" style="background:#49eacb;color:#1a1a2e;">📱</div>
                    <div class="ksp-wallet-info">
                        <div class="ksp-wallet-name">Open Wallet App</div>
                        <div class="ksp-wallet-desc">Kaspa-compatible wallet</div>
                    </div>
                </a>`;
        }

        var modalContent = `
            <div class="ksp-header">
                <h2 class="ksp-title">${escapeHtml(item)}</h2>
                <button class="ksp-close" id="ksp-close">&times;</button>
            </div>
            <div class="ksp-body">
                <div class="ksp-amount">
                    <div class="ksp-amount-value">${formatKas(amount)} KAS</div>
                    <div class="ksp-amount-label">${escapeHtml(item)}</div>
                </div>
                
                ${walletsHtml ? '<div class="ksp-wallets">' + walletsHtml + '</div>' : ''}
                ${walletsHtml ? '<div class="ksp-divider">or scan QR code</div>' : ''}
                
                <div class="ksp-qr-section">
                    <img class="ksp-qr-img" src="${generateQR(kaspaUri, 180)}" alt="QR Code">
                    <div class="ksp-address-box">
                        <span class="ksp-address">${address}</span>
                        <button class="ksp-copy-btn" id="ksp-copy">Copy</button>
                    </div>
                </div>
            </div>
            <div class="ksp-footer">
                <a href="https://github.com/nicozak/kaspa-pay-modal" target="_blank">Kaspa Pay Modal</a>
            </div>
        `;

        document.getElementById('kaspa-pay-modal').innerHTML = modalContent;

        // Event listeners
        document.getElementById('ksp-close').onclick = KaspaPay.close;
        document.getElementById('ksp-copy').onclick = function() {
            copyToClipboard(address);
            this.textContent = 'Copied!';
            var btn = this;
            setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        };

        // Wallet buttons
        document.querySelectorAll('.ksp-wallet-btn[data-wallet]').forEach(function(btn) {
            btn.onclick = function() {
                if (KaspaPay.processing) return;
                KaspaPay.processing = true;
                var wallet = this.dataset.wallet;
                payWithWallet(wallet);
            };
        });

        // Start polling for payment
        startPolling();
    }

    function renderProcessing() {
        document.getElementById('kaspa-pay-modal').innerHTML = `
            <div class="ksp-header">
                <h2 class="ksp-title">Processing</h2>
                <button class="ksp-close" id="ksp-close">&times;</button>
            </div>
            <div class="ksp-body">
                <div class="ksp-status">
                    <div class="ksp-spinner"></div>
                    <div class="ksp-status-text">Waiting for payment...</div>
                    <div class="ksp-status-sub">Checking blockchain for confirmation</div>
                </div>
            </div>
        `;
        document.getElementById('ksp-close').onclick = KaspaPay.close;
    }

    function renderSuccess(txid) {
        stopPolling();
        
        document.getElementById('kaspa-pay-modal').innerHTML = `
            <div class="ksp-header">
                <h2 class="ksp-title">Payment Complete</h2>
                <button class="ksp-close" id="ksp-close">&times;</button>
            </div>
            <div class="ksp-body">
                <div class="ksp-status">
                    <div class="ksp-success-icon">✓</div>
                    <div class="ksp-status-text">Thank you!</div>
                    <div class="ksp-status-sub">Your payment has been confirmed</div>
                </div>
                <button class="ksp-btn-primary" id="ksp-done">Done</button>
            </div>
            <div class="ksp-footer">
                <a href="https://explorer.kaspa.org/txs/${txid}" target="_blank">View transaction →</a>
            </div>
        `;
        
        document.getElementById('ksp-close').onclick = KaspaPay.close;
        document.getElementById('ksp-done').onclick = KaspaPay.close;

        // Callback
        if (KaspaPay.config.onSuccess) {
            KaspaPay.config.onSuccess({ txid: txid });
        }
    }

    // =============================================
    // Wallet Payments
    // =============================================

    async function payWithWallet(walletType) {
        var address = KaspaPay.config.address;
        var amount = KaspaPay.config.amount;
        var sompiAmount = Math.round(amount * 100000000);

        renderProcessing();

        try {
            var txid;

            if (walletType === 'kasware') {
                txid = await window.kasware.sendKaspa(address, sompiAmount, {});
            } else if (walletType === 'kastle') {
                txid = await window.kastle.sendKaspa(address, sompiAmount, {});
            }

            if (txid) {
                renderSuccess(txid);
            }
        } catch (error) {
            console.error('Payment error:', error);
            KaspaPay.processing = false;
            renderWalletPicker(); // Go back to picker
            alert('Payment failed: ' + (error.message || 'Unknown error'));
        }
    }

    // =============================================
    // Blockchain Polling (for QR/manual payments)
    // =============================================

    function startPolling() {
        if (KaspaPay.pollInterval) return;

        var address = KaspaPay.config.address;
        var amount = KaspaPay.config.amount;
        var startTime = Date.now();

        // Get initial balance
        getBalance(address).then(function(initialBalance) {
            KaspaPay.initialBalance = initialBalance;

            KaspaPay.pollInterval = setInterval(function() {
                // Timeout after 30 minutes
                if (Date.now() - startTime > 30 * 60 * 1000) {
                    stopPolling();
                    return;
                }

                checkForPayment(address, amount);
            }, 5000); // Check every 5 seconds
        });
    }

    function stopPolling() {
        if (KaspaPay.pollInterval) {
            clearInterval(KaspaPay.pollInterval);
            KaspaPay.pollInterval = null;
        }
    }

    async function getBalance(address) {
        try {
            var response = await fetch('https://api.kaspa.org/addresses/' + address + '/balance');
            var data = await response.json();
            return parseInt(data.balance) || 0;
        } catch (e) {
            return 0;
        }
    }

    async function checkForPayment(address, expectedAmount) {
        try {
            var response = await fetch('https://api.kaspa.org/addresses/' + address + '/utxos');
            var utxos = await response.json();

            var expectedSompi = Math.round(expectedAmount * 100000000);
            var tolerance = 10000; // 0.0001 KAS tolerance

            // Check recent UTXOs for matching amount
            for (var i = 0; i < utxos.length; i++) {
                var utxo = utxos[i];
                var utxoAmount = parseInt(utxo.utxoEntry.amount);
                if (Math.abs(utxoAmount - expectedSompi) <= tolerance) {
                    // Found matching payment!
                    renderSuccess(utxo.outpoint.transactionId);
                    return;
                }
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    }

    // =============================================
    // Utilities
    // =============================================

    function formatKas(amount) {
        var num = parseFloat(amount) || 0;
        return num.toLocaleString(undefined, { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 4 
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }

    // =============================================
    // Public API
    // =============================================

    KaspaPay.open = function(options) {
        // Reset any previous state
        stopPolling();
        KaspaPay.processing = false;

        if (!options.address || !options.address.startsWith('kaspa:')) {
            console.error('KaspaPay: Valid kaspa address required');
            return;
        }

        KaspaPay.config = {
            address: options.address,
            amount: parseFloat(options.amount) || 0,
            item: options.item || 'Payment',
            theme: options.theme || 'dark',
            onSuccess: options.onSuccess || null
        };

        injectStyles();

        if (!KaspaPay.modal) {
            createModal();
        } else {
            // Update theme
            document.getElementById('kaspa-pay-modal').className = 'ksp-modal ' + KaspaPay.config.theme;
        }

        renderWalletPicker();

        // Show modal
        setTimeout(function() {
            KaspaPay.modal.classList.add('open');
        }, 10);
    };

    KaspaPay.close = function() {
        stopPolling();
        KaspaPay.processing = false;
        if (KaspaPay.modal) {
            KaspaPay.modal.classList.remove('open');
        }
    };

    // =============================================
    // Auto-init from data attributes
    // =============================================

    function init() {
        var container = document.getElementById('kaspa-pay');
        if (!container) return;

        var address = container.dataset.address;
        var amount = container.dataset.amount;
        var item = container.dataset.item || 'Payment';
        var theme = container.dataset.theme || 'dark';

        if (!address) {
            console.error('KaspaPay: data-address required');
            return;
        }

        // Create button
        injectStyles();
        
		var btn = document.createElement('button');
		btn.className = 'ksp-btn-primary';
		btn.style.cssText = 'max-width: 280px; margin: 0; background: #49eacb; color: #1a1a2e;';
        btn.textContent = amount ? 'Pay ' + formatKas(amount) + ' KAS' : 'Pay with Kaspa';
        btn.onclick = function() {
            KaspaPay.open({
                address: address,
                amount: amount,
                item: item,
                theme: theme
            });
        };

        container.appendChild(btn);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose globally
    window.KaspaPay = KaspaPay;

})();
