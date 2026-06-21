"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface DictionaryItem {
  shina: string;
  [key: string]: unknown;
}

export default function Home() {
  const [displayText, setDisplayText] = useState("");
  const [currentMode, setCurrentMode] = useState<"shina" | "english" | "numeric" | "aerab">("shina");
  const [shiftActive, setShiftActive] = useState<number>(0); // 0 = off, 1 = shift, 2 = caps lock/long press shift
  const [dictionary, setDictionary] = useState<DictionaryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState("TEXT COPIED");
  const [showToast, setShowToast] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deleteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const deleteCountRef = useRef<number>(0);
  const isLongPressRef = useRef(false);

  // Standard diacritics to strip. We EXCLUDE \u0615 (Retroflex) and \u0653 (Madda) to preserve letter identity.
  const aerabRegex = /[\u064B-\u0652\u0654-\u065F\u0610-\u0614\u0616-\u061A\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;

  const longPressMappings: Record<string, string> = {
    'ی': '\u0620', 'ن': '\u06BA', 'ا': 'آ', 'ہ': 'ھ', 'ج': 'ذ',
    'چ': '\u0687', 'ش': '\u075C', 'ت': 'ٹ', 'ک': 'خ', 'د': 'ڈ', 'ھ': 'ح',
    'گ': 'غ', 'ر': 'ڑ', 'ز': '\u0699', 'ط': 'ظ', 'ص': 'ض', 'س': 'ث', 'ژ': '\u0685', 'م': 'نؕ',
    '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹', '0': '۰'
  };

  const layouts = {
    shina: [
      ['ق', 'و', 'ع', 'ر', 'ت', 'ے', 'ء', 'ی', 'ہ', 'پ'],
      ['ا', 'س', 'د', 'ف', 'گ', '\u06BE', 'ج', 'ک', 'ل', 'ط'],
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
      ['\u064E', '\u0650', '\u064F', '\u064B', '\u064D', '\u064C', '\u0651', '\u08FF'],
      ['\u0670', '\u0656', '\u0657', '\u0654', '\u0655', '\u0615', '\u0658', '\u065B'],
      ['۔', ',', '!', '؟', '(', ')', '[', ']', '⌫'],
      ['123', 'ABC', 'اردو', ' ', 'ENTER']
    ]
  };

  useEffect(() => {
    // Load dictionary on client mount
    fetch("/dictionary.json")
      .then((res) => res.json())
      .then((data: DictionaryItem[]) => setDictionary(data))
      .catch((e) => console.error("Load dictionary failed", e));
  }, []);

  const normalize = (text: string) => {
    if (!text) return "";
    const n = text.replace(/\u0627\u0653/g, '\u0622');
    return n.replace(aerabRegex, "").trim();
  };

  const updateSuggestions = (text: string, selectionStart: number) => {
    if (!text) {
      setSuggestions([]);
      return;
    }
    const lastSpace = text.lastIndexOf(' ', selectionStart - 1);
    const currentWord = text.substring(lastSpace + 1, selectionStart);

    if (currentWord.length < 1) {
      setSuggestions([]);
      return;
    }

    const normalizedInput = normalize(currentWord);

    // 1. Prioritize words that START with the input
    const startMatches = dictionary.filter(item =>
      normalize(item.shina).startsWith(normalizedInput)
    );

    // 2. If we need more suggestions, find words that CONTAIN the input anywhere
    let fuzzyMatches: DictionaryItem[] = [];
    if (startMatches.length < 10) {
      fuzzyMatches = dictionary.filter(item => {
        const normWord = normalize(item.shina);
        return !normWord.startsWith(normalizedInput) && normWord.includes(normalizedInput);
      });
    }

    const finalMatches = [...startMatches, ...fuzzyMatches].slice(0, 15);
    setSuggestions(finalMatches.map(item => item.shina));
  };

  const insertText = (char: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = displayText.substring(0, start) + char + displayText.substring(end);

    setDisplayText(newText);

    // Schedule caret selection update on next tick
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + char.length;
      updateSuggestions(newText, start + char.length);
    }, 0);
  };

  const backspace = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start > 0) {
      const newText = displayText.substring(0, start - 1) + displayText.substring(end);
      setDisplayText(newText);

      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start - 1;
        updateSuggestions(newText, start - 1);
      }, 0);
    } else {
      setTimeout(() => {
        textarea.focus();
      }, 0);
    }
  };

  const applySuggestion = (word: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = displayText;
    const pos = textarea.selectionStart;
    const lastSpace = text.lastIndexOf(' ', pos - 1);
    const before = text.substring(0, lastSpace + 1);
    const after = text.substring(pos);
    const newText = before + word + " " + after;

    setDisplayText(newText);
    setSuggestions([]);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = before.length + word.length + 1;
    }, 0);
  };

  const copyText = () => {
    if (!displayText) return;
    navigator.clipboard.writeText(displayText).then(() => {
      setToastMessage("TEXT COPIED");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    });
  };

  const runDeletion = () => {
    backspace();
    deleteCountRef.current += 1;
    // Slow (150ms) for the first 5 deleted characters, then fast (50ms)
    const delay = deleteCountRef.current > 5 ? 50 : 150;
    deleteIntervalRef.current = setTimeout(runDeletion, delay);
  };

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent, key: string) => {
    e.preventDefault();
    isLongPressRef.current = false;

    if (window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }

    if (key === '⌫') {
      backspace();
      deleteCountRef.current = 0;
      deleteIntervalRef.current = setTimeout(runDeletion, 500);
    } else {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        if (key === '⇧') {
          setShiftActive(2);
        } else if (longPressMappings[key]) {
          insertText(longPressMappings[key]);
        }
      }, 500);
    }
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent, key: string, label: string) => {
    e.preventDefault();
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (deleteIntervalRef.current) {
      clearTimeout(deleteIntervalRef.current);
      clearInterval(deleteIntervalRef.current);
    }

    if (!isLongPressRef.current && key !== '⌫') {
      if (key === 'ENTER') {
        insertText('\n');
      } else if (key === '⇧') {
        setShiftActive(prev => prev === 0 ? 1 : 0);
      } else if (key === '123') {
        setCurrentMode('numeric');
        setShiftActive(0);
      } else if (key === 'ABC') {
        setCurrentMode('english');
        setShiftActive(0);
      } else if (key === 'اردو') {
        setCurrentMode('shina');
        setShiftActive(0);
      } else if (key === '◌َ◌ِ') {
        setCurrentMode('aerab');
        setShiftActive(0);
      } else {
        insertText(label);
        if (shiftActive === 1) {
          setShiftActive(0);
        }
      }
    }
  };

  const isRtl = currentMode !== 'english';
  const containerClass = `keyboard-container ${isRtl ? 'shina-font' : 'modern-font'}`;

  return (
    <div className="app-wrapper">
      <div className="header-container">
        <header>
          <h1 className="logo">Shina Keyboard</h1>
          <p className="tagline">by Younis Majeed</p>
        </header>
        <button 
          className="btn-settings-toggle" 
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="settings-overlay">
          <h2 style={{ fontSize: "12px", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent-turquoise)" }}>Settings</h2>
          <Link href="/about" style={{ textDecoration: "none" }}>
            <div className="settings-card">
              <div className="settings-card-content">
                <h3>About Us</h3>
                <p>Learn about the Shina Keyboard team & credits.</p>
              </div>
              <div className="settings-card-arrow">→</div>
            </div>
          </Link>
        </div>
      )}

      <div className="top-section">
        <div className="controls">
          <button className="btn-copy" id="copy-btn" onClick={copyText}>COPY TEXT</button>
        </div>
        <textarea
          id="display-area"
          ref={textareaRef}
          value={displayText}
          onChange={(e) => {
            setDisplayText(e.target.value);
            updateSuggestions(e.target.value, e.target.selectionStart || 0);
          }}
          onSelect={(e) => {
            const target = e.target as HTMLTextAreaElement;
            updateSuggestions(target.value, target.selectionStart || 0);
          }}
          inputMode="none"
          placeholder="ٹائپ تھیا..."
          autoFocus
          style={{
            direction: isRtl ? "rtl" : "ltr",
            textAlign: isRtl ? "right" : "left"
          }}
        />
      </div>

      <div className={containerClass} id="kb-container">
        <div id="suggestion-bar" className="suggestion-bar">
          {suggestions.map((word, idx) => (
            <span
              key={idx}
              className="suggestion-item"
              onClick={() => applySuggestion(word)}
            >
              {word}
            </span>
          ))}
        </div>

        <div id="keyboard-layout">
          {layouts[currentMode].map((row, rowIdx) => (
            <div key={rowIdx} className="row">
              {row.map((key, keyIdx) => {
                let label = key;
                if (currentMode === 'english' && /[a-z]/.test(key)) {
                  label = shiftActive ? key.toUpperCase() : key;
                }
                const isSpace = key === ' ';
                const isDelete = key === '⌫';
                const isEnter = key === 'ENTER';
                const isToggle = ['123', 'ABC', 'اردو', '◌َ◌ِ'].includes(key);
                const isShiftOn = key === '⇧' && shiftActive > 0;

                let keyClass = "key";
                if (isSpace) keyClass += " space";
                if (isDelete) keyClass += " wide delete";
                if (isEnter) keyClass += " wide enter";
                if (isToggle) keyClass += " mode-toggle";
                if (isShiftOn) keyClass += " shift-on";

                return (
                  <button
                    key={keyIdx}
                    className={keyClass}
                    data-long={longPressMappings[key] || undefined}
                    onMouseDown={(e) => handlePressStart(e, key)}
                    onTouchStart={(e) => handlePressStart(e, key)}
                    onMouseUp={(e) => handlePressEnd(e, key, label)}
                    onTouchEnd={(e) => handlePressEnd(e, key, label)}
                  >
                    {isSpace ? "SPACE" : label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div id="toast" style={{ opacity: showToast ? 1 : 0 }}>
        {toastMessage}
      </div>
    </div>
  );
}
