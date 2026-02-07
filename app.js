/**
 * Shina Keyboard Engine
 * Features: Multi-mode layout, Long-press support, Word Prediction
 * Optimization: Fuzzy matching with Aerab-aware normalization
 */

const Keyboard = {
    elements: {
        display: document.getElementById('display-area'),
        container: document.getElementById('kb-container'),
        layout: document.getElementById('keyboard-layout'),
        suggestions: document.getElementById('suggestion-bar'),
        copyBtn: document.getElementById('copy-btn'),
        toast: document.getElementById('toast')
    },

    state: {
        currentMode: 'shina',
        shiftActive: 0, // 0: off, 1: shift, 2: caps
        longPressTimer: null,
        deleteInterval: null,
        isLongPress: false,
        dictionary: []
    },

    // Regex for standard Aerabs (Zabar, Zer, Pesh, etc.)
    // Note: \u0615 (the high tah) is EXCLUDED so it is treated as part of the letter identity
    aerabRegex: /[\u064B-\u065F\u0610-\u0614\u0616-\u061A\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g,

    mappings: {
        longPress: {
            'ی': '\u0620', // Shina Half Ya
            'ن': '\u06BA', // Noon Ghunna
            'ا': 'آ', 
            'ہ': 'ھ', 
            'ج': 'ج\u0615', 
            'چ': 'چ\u0615', 
            'ش': 'ش\u0615', 
            'ت': 'ٹ', 
            'ک': 'خ', 
            'د': 'ڈ', 
            'گ': 'غ', 
            'ر': 'ڑ', 
            'ز': 'ذ', 
            'ط': 'ظ',
            'ص': 'ض', 
            'س': 'ث',       
            'ژ': 'چھؕ', 
            '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹', '0': '۰'
        },
        layouts: {
            shina: [
                ['ق', 'و', 'ع', 'ر', 'ت', 'ے', 'ء', 'ی', 'ہ', 'پ'], 
                ['ا', 'س', 'د', 'ف', 'گ', 'ح', 'ج', 'ک', 'ل', 'ط'],     
                ['ز', 'ش', 'چ', 'ژ', 'ب', 'ن', 'م', 'ص', '⌫'],     
                ['123', 'ABC', '◌َ◌ِ', ' ', 'ENTER']
            ],
            english: [
                ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '⌫'],
                ['123', 'اردو', '◌َ◌ِ', ' ', 'ENTER']
            ],
            numeric: [
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                ['@', '#', '$', '%', '&', '-', '+', '(', ')', '/'],
                ['<', '>', '*', '"', "'", 'ٛ', '!', '؟', '⌫'],
                ['ABC', 'اردو', '◌َ◌ِ', ' ', 'ENTER']
            ],
            aerab: [
                ['\u064E', '\u0650', '\u064F', '\u064B', '\u064D', '\u064C', '\u0651', '\u0652'],
                ['\u0670', '\u0656', '\u0657', '\u0654', '\u0655', '\u0615', '\u065A', '\u065B'],
                ['۔', ',', '!', '؟', '(', ')', '[', ']', '⌫'],
                ['123', 'ABC', 'اردو', ' ', 'ENTER']
            ]
        }
    },

    async init() {
        await this.loadDictionary();
        this.render();
        this.elements.copyBtn.onclick = () => this.copyText();
        this.initServiceWorker();
    },

    async loadDictionary() {
        try {
            const response = await fetch('dictionary.json');
            this.state.dictionary = await response.json();
        } catch (e) {
            console.error("Dictionary file missing or invalid.", e);
        }
    },

    normalize(text) {
        if (!text) return "";
        // Removes standard vowels but keeps the Shina-specific high tah (\u0615)
        return text.replace(this.aerabRegex, "").trim();
    },

    getCurrentWord() {
        const text = this.elements.display.value;
        const pos = this.elements.display.selectionStart;
        const lastSpace = text.lastIndexOf(' ', pos - 1);
        return text.substring(lastSpace + 1, pos);
    },

    updateSuggestions() {
        const currentWord = this.getCurrentWord();
        this.elements.suggestions.innerHTML = '';
        if (currentWord.length < 1) return;

        const normalizedInput = this.normalize(currentWord);

        const matches = this.state.dictionary
            .filter(item => {
                const normalizedDictWord = this.normalize(item.shina);
                return normalizedDictWord.startsWith(normalizedInput) || 
                       (normalizedInput.length > 2 && normalizedDictWord.includes(normalizedInput));
            })
            .slice(0, 10);

        matches.forEach(match => {
            const span = document.createElement('span');
            span.className = 'suggestion-item';
            span.textContent = match.shina;
            span.onclick = () => this.applySuggestion(match.shina);
            this.elements.suggestions.appendChild(span);
        });
    },

    applySuggestion(word) {
        const { display } = this.elements;
        const text = display.value;
        const pos = display.selectionStart;
        const lastSpace = text.lastIndexOf(' ', pos - 1);
        
        const before = text.substring(0, lastSpace + 1);
        const after = text.substring(pos);
        
        display.value = before + word + " " + after;
        display.selectionStart = display.selectionEnd = before.length + word.length + 1;
        this.elements.suggestions.innerHTML = '';
        display.focus();
    },

    render() {
        const { layout, display, container } = this.elements;
        const { currentMode, shiftActive } = this.state;
        layout.innerHTML = '';
        const isRtl = currentMode !== 'english';

        display.style.direction = isRtl ? 'rtl' : 'ltr';
        display.style.textAlign = isRtl ? 'right' : 'left';
        container.className = `keyboard-container ${isRtl ? 'shina-font' : 'modern-font'}`;

        this.mappings.layouts[currentMode].forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            row.forEach(key => {
                const btn = this.createKey(key, shiftActive);
                rowDiv.appendChild(btn);
            });
            layout.appendChild(rowDiv);
        });
    },

    createKey(key, shiftActive) {
        const btn = document.createElement('button');
        btn.className = 'key';
        let label = key;

        if (this.state.currentMode === 'english' && /[a-z]/.test(key)) {
            label = shiftActive ? key.toUpperCase() : key;
        }
        btn.textContent = (key === ' ') ? 'SPACE' : label;

        if (key === ' ') btn.classList.add('space');
        if (key === '⌫') btn.classList.add('wide', 'delete');
        if (key === 'ENTER') btn.classList.add('wide', 'enter');
        if (['123', 'ABC', 'اردو', '◌َ◌ِ'].includes(key)) btn.classList.add('mode-toggle');
        if (key === '⇧' && shiftActive) btn.classList.add('shift-on');
        if (this.mappings.longPress[key]) btn.setAttribute('data-long', this.mappings.longPress[key]);

        btn.onmousedown = btn.ontouchstart = (e) => this.handlePressStart(e, key);
        btn.onmouseup = btn.ontouchend = (e) => this.handlePressEnd(e, key, label);
        return btn;
    },

    handlePressStart(e, key) {
        e.preventDefault();
        this.state.isLongPress = false;
        if (window.navigator.vibrate) window.navigator.vibrate(10);

        if (key === '⌫') {
            this.backspace();
            this.state.deleteInterval = setTimeout(() => {
                this.state.deleteInterval = setInterval(() => this.backspace(), 50);
            }, 500);
        } else {
            this.state.longPressTimer = setTimeout(() => {
                this.state.isLongPress = true;
                if (key === '⇧') {
                    this.state.shiftActive = 2; // Caps Lock
                    this.render();
                } else if (this.mappings.longPress[key]) {
                    this.insertText(this.mappings.longPress[key]);
                }
            }, 500);
        }
    },

    handlePressEnd(e, key, label) {
        clearTimeout(this.state.longPressTimer);
        clearInterval(this.state.deleteInterval);

        if (!this.state.isLongPress && key !== '⌫') {
            if (key === 'ENTER') this.insertText('\n');
            else if (key === '⇧') {
                this.state.shiftActive = this.state.shiftActive === 0 ? 1 : 0;
                this.render();
            }
            else if (key === '123') this.switchMode('numeric');
            else if (key === 'ABC') this.switchMode('english');
            else if (key === 'اردو') this.switchMode('shina');
            else if (key === '◌َ◌ِ') this.switchMode('aerab');
            else {
                this.insertText(label);
                // Auto-revert shift after one character
                if (this.state.shiftActive === 1) {
                    this.state.shiftActive = 0;
                    this.render();
                }
            }
        }
    },

    insertText(char) {
        const { display } = this.elements;
        const start = display.selectionStart;
        const end = display.selectionEnd;
        display.value = display.value.substring(0, start) + char + display.value.substring(end);
        display.selectionStart = display.selectionEnd = start + char.length;
        this.updateSuggestions();
        display.focus();
    },

    backspace() {
        const { display } = this.elements;
        const start = display.selectionStart;
        const end = display.selectionEnd;
        if (start === end && start > 0) {
            display.value = display.value.substring(0, start - 1) + display.value.substring(end);
            display.selectionStart = display.selectionEnd = start - 1;
        } else if (start !== end) {
            display.value = display.value.substring(0, start) + display.value.substring(end);
            display.selectionStart = display.selectionEnd = start;
        }
        this.updateSuggestions();
        display.focus();
    },

    switchMode(mode) {
        this.state.currentMode = mode;
        this.state.shiftActive = 0;
        this.render();
    },

    copyText() {
        const val = this.elements.display.value;
        if (!val) return;
        navigator.clipboard.writeText(val).then(() => {
            this.elements.toast.style.opacity = '1';
            setTimeout(() => this.elements.toast.style.opacity = '0', 2000);
        });
    },

    initServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error', err));
            });
        }
    }
};

// Initialize the keyboard app
Keyboard.init();