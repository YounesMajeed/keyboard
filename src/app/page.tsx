"use client";

import { useState, useEffect, useRef } from "react";

// Standard diacritics to strip. We EXCLUDE \u0615 (Retroflex) and \u0653 (Madda) to preserve letter identity.
const aerabRegex = /[\u064B-\u0652\u0654-\u065F\u0610-\u0614\u0616-\u061A\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;

const normalize = (text: string) => {
  if (!text) return "";
  const n = text.replace(/\u0627\u0653/g, '\u0622');
  return n.replace(aerabRegex, "").trim();
};

const getWordAtPosition = (text: string, pos: number) => {
  if (!text) return { word: "", start: 0 };
  let lastWhitespace = -1;
  for (let i = pos - 1; i >= 0; i--) {
    if (/\s/.test(text[i])) {
      lastWhitespace = i;
      break;
    }
  }
  const start = lastWhitespace + 1;
  const word = text.substring(start, pos);
  return { word, start };
};

const isDiacritic = (char: string) => {
  return /[\u064B-\u065F\u0670\u08FF\u0610-\u061A]/.test(char) && char.length === 1;
};

const isBelowDiacritic = (char: string) => {
  return ['\u0650', '\u064D', '\u0655', '\u0656'].includes(char);
};

const diacriticNames: Record<string, string> = {
  '\u064E': 'Fatha',
  '\u0650': 'Kasra',
  '\u064F': 'Damma',
  '\u064B': 'Fathatan',
  '\u064D': 'Kasratan',
  '\u064C': 'Dammatan',
  '\u0651': 'Shadda',
  '\u08FF': 'Sideways Noon Ghunna',
  '\u0670': 'Superscript Alef',
  '\u0656': 'Subscript Alef',
  '\u0657': 'Inverted Damma',
  '\u0654': 'Hamza Above',
  '\u0655': 'Hamza Below',
  '\u0615': 'Small High Tah (Retroflex)',
  '\u0658': 'Noon Ghunna Above',
  '\u065B': 'Inverted Damma Vowel Sign'
};

interface DictionaryItem {
  shina: string;
  normalizedShina?: string;
  [key: string]: unknown;
}

interface Note {
  id: string;
  title: string;
  content: string;
  color: 'default' | 'red' | 'yellow' | 'green' | 'blue' | 'purple';
  updatedAt: number;
}

export default function Home() {
  const [displayText, setDisplayText] = useState("");
  const [currentMode, setCurrentMode] = useState<"shina" | "english" | "numeric" | "aerab">("shina");
  const [shiftActive, setShiftActive] = useState<number>(0); // 0 = off, 1 = shift, 2 = caps lock/long press shift
  const [dictionary, setDictionary] = useState<DictionaryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState("TEXT COPIED");
  const [showToast, setShowToast] = useState(false);

  // Notes state hooks
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteColor, setNoteColor] = useState<'default' | 'red' | 'yellow' | 'green' | 'blue' | 'purple'>("default");
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [activeField, setActiveField] = useState<"title" | "content">("content");
  const activeFieldRef = useRef(activeField);
  const noteTitleRef = useRef(noteTitle);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  useEffect(() => {
    noteTitleRef.current = noteTitle;
  }, [noteTitle]);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deleteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deleteCountRef = useRef<number>(0);
  const isLongPressRef = useRef(false);

  const displayTextRef = useRef(displayText);
  useEffect(() => {
    displayTextRef.current = displayText;
  }, [displayText]);

  // Load notes on client mount
  useEffect(() => {
    const saved = localStorage.getItem("shina_keyboard_notes");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTimeout(() => {
          setNotes(parsed);
        }, 0);
      } catch (e) {
        console.error("Load notes failed", e);
      }
    }
  }, []);

  // Debounced auto-save notes triggers
  useEffect(() => {
    if (!currentNoteId && !displayText && !noteTitle) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      let activeId = currentNoteId;
      let isNew = false;
      if (!activeId) {
        activeId = Date.now().toString();
        isNew = true;
      }

      const updatedNote: Note = {
        id: activeId,
        title: noteTitle,
        content: displayText,
        color: noteColor,
        updatedAt: Date.now()
      };

      setNotes(prevNotes => {
        let newNotes;
        if (isNew) {
          newNotes = [updatedNote, ...prevNotes];
        } else {
          const filtered = prevNotes.filter(n => n.id !== activeId);
          newNotes = [updatedNote, ...filtered];
        }
        localStorage.setItem("shina_keyboard_notes", JSON.stringify(newNotes));
        return newNotes;
      });

      if (isNew) {
        setCurrentNoteId(activeId);
      }
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [displayText, noteTitle, noteColor, currentNoteId]);

  // Notes action helpers
  const createNewNote = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setCurrentNoteId(null);
    setNoteTitle("");
    setDisplayText("");
    setNoteColor("default");
    setSuggestions([]);
    setActiveField("content");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const loadNote = (note: Note) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setCurrentNoteId(note.id);
    setNoteTitle(note.title);
    setDisplayText(note.content);
    setNoteColor(note.color);
    setSuggestions([]);
    setShowNotesDrawer(false);
    setActiveField("content");
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  const deleteNote = (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setNotes(prevNotes => {
      const newNotes = prevNotes.filter(n => n.id !== noteId);
      localStorage.setItem("shina_keyboard_notes", JSON.stringify(newNotes));
      return newNotes;
    });

    if (currentNoteId === noteId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      setCurrentNoteId(null);
      setNoteTitle("");
      setDisplayText("");
      setNoteColor("default");
      setSuggestions([]);
    }
  };

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
      ['123', 'ABC', '◌ٗ', ' ', 'ENTER']
    ],
    english: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '⌫'],
      ['123', 'ݜ', '◌ٗ', ' ', 'ENTER']
    ],
    numeric: [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['@', '#', '$', '%', '&', '-', '+', '(', ')', '/'],
      ['<', '>', '*', '"', "'", 'ٛ', '!', '؟', '⌫'],
      ['ABC', 'ݜ', '◌ٗ', ' ', 'ENTER']
    ],
    aerab: [
      ['\u064E', '\u0650', '\u064F', '\u064B', '\u064D', '\u064C', '\u0651', '\u08FF'],
      ['\u0670', '\u0656', '\u0657', '\u0654', '\u0655', '\u0615', '\u0658', '\u065B'],
      ['۔', ',', '!', '؟', '(', ')', '[', ']', '⌫'],
      ['123', 'ABC', 'ݜ', ' ', 'ENTER']
    ]
  };

  useEffect(() => {
    // Load dictionary on client mount
    fetch("/dictionary.json")
      .then((res) => res.json())
      .then((data: DictionaryItem[]) => {
        const processed = data.map(item => ({
          ...item,
          normalizedShina: normalize(item.shina)
        }));
        setDictionary(processed);
      })
      .catch((e) => console.error("Load dictionary failed", e));
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (deleteIntervalRef.current) clearTimeout(deleteIntervalRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const updateSuggestions = (text: string, selectionStart: number) => {
    if (!text) {
      setSuggestions([]);
      return;
    }
    const { word: currentWord } = getWordAtPosition(text, selectionStart);

    if (currentWord.length < 1) {
      setSuggestions([]);
      return;
    }

    const normalizedInput = normalize(currentWord);

    // 1. Prioritize words that START with the input (using pre-normalized values)
    const startMatches = dictionary.filter(item =>
      (item.normalizedShina || "").startsWith(normalizedInput)
    );

    // 2. If we need more suggestions, find words that CONTAIN the input anywhere
    let fuzzyMatches: DictionaryItem[] = [];
    if (startMatches.length < 10) {
      fuzzyMatches = dictionary.filter(item => {
        const normWord = item.normalizedShina || "";
        return !normWord.startsWith(normalizedInput) && normWord.includes(normalizedInput);
      });
    }

    const finalMatches = [...startMatches, ...fuzzyMatches].slice(0, 15);
    setSuggestions(finalMatches.map(item => item.shina));
  };

  const insertText = (char: string) => {
    const isTitle = activeFieldRef.current === "title";
    const inputEl = isTitle ? titleInputRef.current : textareaRef.current;
    if (!inputEl) return;

    const start = inputEl.selectionStart ?? 0;
    const end = inputEl.selectionEnd ?? 0;
    const currentText = isTitle ? noteTitleRef.current : displayTextRef.current;
    const newText = currentText.substring(0, start) + char + currentText.substring(end);

    if (isTitle) {
      noteTitleRef.current = newText;
      setNoteTitle(newText);
    } else {
      displayTextRef.current = newText;
      setDisplayText(newText);
    }

    // Schedule caret selection update on next tick
    setTimeout(() => {
      inputEl.focus();
      inputEl.selectionStart = inputEl.selectionEnd = start + char.length;
      if (!isTitle) {
        updateSuggestions(newText, start + char.length);
      } else {
        setSuggestions([]);
      }
    }, 0);
  };

  const backspace = () => {
    const isTitle = activeFieldRef.current === "title";
    const inputEl = isTitle ? titleInputRef.current : textareaRef.current;
    if (!inputEl) return;

    const start = inputEl.selectionStart ?? 0;
    const end = inputEl.selectionEnd ?? 0;
    const currentText = isTitle ? noteTitleRef.current : displayTextRef.current;

    if (start > 0 || end > start) {
      const deleteStart = start === end ? start - 1 : start;
      const newText = currentText.substring(0, deleteStart) + currentText.substring(end);
      
      if (isTitle) {
        noteTitleRef.current = newText;
        setNoteTitle(newText);
      } else {
        displayTextRef.current = newText;
        setDisplayText(newText);
      }

      setTimeout(() => {
        inputEl.focus();
        inputEl.selectionStart = inputEl.selectionEnd = deleteStart;
        if (!isTitle) {
          updateSuggestions(newText, deleteStart);
        } else {
          setSuggestions([]);
        }
      }, 0);
    } else {
      setTimeout(() => {
        inputEl.focus();
      }, 0);
    }
  };

  const applySuggestion = (word: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = displayTextRef.current;
    const pos = textarea.selectionStart;
    const { start } = getWordAtPosition(text, pos);
    const before = text.substring(0, start);
    const after = text.substring(pos);
    const newText = before + word + " " + after;

    displayTextRef.current = newText;
    setDisplayText(newText);
    setSuggestions([]);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = before.length + word.length + 1;
    }, 0);
  };

  const fallbackCopyText = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.select();
    try {
      document.execCommand('copy');
      setToastMessage("TEXT COPIED");
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error("Fallback copy failed", err);
      setToastMessage("COPY FAILED");
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
    }
    textarea.selectionStart = start;
    textarea.selectionEnd = end;
  };

  const copyText = () => {
    if (!displayText) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(displayText).then(() => {
        setToastMessage("TEXT COPIED");
        setShowToast(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
      }).catch((err) => {
        console.error("Clipboard copy failed", err);
        fallbackCopyText();
      });
    } else {
      fallbackCopyText();
    }
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
      } else if (key === 'اردو' || key === 'ݜ') {
        setCurrentMode('shina');
        setShiftActive(0);
      } else if (key === '◌َ◌ِ' || key === '◌ٗ') {
        setCurrentMode('aerab');
        setShiftActive(0);
      } else {
        insertText(isDiacritic(key) ? key : label);
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
          <svg className="icon-keyboard" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-turquoise)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
            <line x1="6" y1="8" x2="6" y2="8"></line>
            <line x1="10" y1="8" x2="10" y2="8"></line>
            <line x1="14" y1="8" x2="14" y2="8"></line>
            <line x1="18" y1="8" x2="18" y2="8"></line>
            <line x1="6" y1="12" x2="6" y2="12"></line>
            <line x1="10" y1="12" x2="10" y2="12"></line>
            <line x1="14" y1="12" x2="14" y2="12"></line>
            <line x1="18" y1="12" x2="18" y2="12"></line>
            <line x1="7" y1="16" x2="17" y2="16"></line>
          </svg>
          <h1 className="logo">ݜِنؕاٗ Keyboard</h1>
        </header>
        <button
          className="btn-notes-toggle"
          onClick={() => setShowNotesDrawer(true)}
          aria-label="View Saved Notes"
        >
          <svg className="icon-folder" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span>Notes</span>
        </button>
      </div>

      <div className="top-section" style={{ backgroundColor: `var(--bg-card-${noteColor})` }}>
        <div className="note-header-controls">
          <input
            type="text"
            ref={titleInputRef}
            className="note-title-input"
            placeholder="Title"
            value={noteTitle}
            onChange={(e) => {
              setNoteTitle(e.target.value);
              noteTitleRef.current = e.target.value;
            }}
            onFocus={() => setActiveField("title")}
          />
          <div className="editor-actions">
            <button className="btn-new-note" onClick={createNewNote} title="New Note" aria-label="New Note">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            {currentNoteId && (
              <button className="btn-delete-note" onClick={() => deleteNote(currentNoteId)} title="Delete Note" aria-label="Delete Note">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            )}
            <button className="btn-copy-note" id="copy-btn" onClick={copyText} title="Copy Text" aria-label="Copy Text">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>
        <textarea
          id="display-area"
          ref={textareaRef}
          value={displayText}
          onChange={(e) => {
            setDisplayText(e.target.value);
            displayTextRef.current = e.target.value;
            updateSuggestions(e.target.value, e.target.selectionStart || 0);
          }}
          onSelect={(e) => {
            const target = e.target as HTMLTextAreaElement;
            updateSuggestions(target.value, target.selectionStart || 0);
          }}
          onFocus={() => setActiveField("content")}
          inputMode="none"
          placeholder="ٹائپ تھیا..."
          autoFocus
          style={{
            direction: isRtl ? "rtl" : "ltr",
            textAlign: isRtl ? "right" : "left"
          }}
        />

        {/* Color picker palette */}
        <div className="color-picker">
          {(['default', 'red', 'yellow', 'green', 'blue', 'purple'] as const).map((color) => (
            <button
              key={color}
              className={`color-dot ${color} ${noteColor === color ? 'active' : ''}`}
              onClick={() => setNoteColor(color)}
              aria-label={`Set note color ${color}`}
            />
          ))}
        </div>
      </div>

      <div className={containerClass} id="kb-container">
        <div id="suggestion-bar" className="suggestion-bar" role="listbox" aria-label="Word suggestions">
          {suggestions.map((word, idx) => (
            <span
              key={idx}
              className="suggestion-item"
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => applySuggestion(word)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  applySuggestion(word);
                }
              }}
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
                const isKeyDiacritic = isDiacritic(key);
                const isSpace = key === ' ';
                const isDelete = key === '⌫';
                const isEnter = key === 'ENTER';
                const isToggle = ['123', 'ABC', 'اردو', 'ݜ', '◌َ◌ِ', '◌ٗ'].includes(key);
                const isShiftOn = key === '⇧' && shiftActive > 0;

                let keyClass = "key";
                if (isSpace) keyClass += " space";
                if (isDelete) keyClass += " wide delete";
                if (isEnter) keyClass += " wide enter";
                if (isToggle) keyClass += " mode-toggle";
                if (isShiftOn) keyClass += " shift-on";
                if (isKeyDiacritic) keyClass += " diacritic";

                let ariaLabel = label;
                if (isSpace) ariaLabel = "Space";
                else if (isDelete) ariaLabel = "Backspace";
                else if (isEnter) ariaLabel = "Enter";
                else if (key === '⇧') ariaLabel = "Shift";
                else if (key === '123') ariaLabel = "Switch to numbers and symbols";
                else if (key === 'ABC') ariaLabel = "Switch to English layout";
                else if (key === 'اردو' || key === 'ݜ') ariaLabel = "Switch to Shina layout";
                else if (key === '◌َ◌ِ' || key === '◌ٗ') ariaLabel = "Switch to diacritics layout";
                else if (isKeyDiacritic) {
                  ariaLabel = diacriticNames[key] ? `${diacriticNames[key]} diacritic` : "Diacritic";
                } else if (longPressMappings[key]) {
                  ariaLabel = `${label}, long press for ${longPressMappings[key]}`;
                }

                let buttonContent: React.ReactNode = isSpace ? "SPACE" : label;
                if (isKeyDiacritic) {
                  const markClass = `diacritic-mark ${isBelowDiacritic(key) ? 'below' : 'above'}`;
                  buttonContent = (
                    <span className="diacritic-btn-content">
                      <span className={markClass}>{"\u200C" + key}</span>
                    </span>
                  );
                }

                return (
                  <button
                    key={keyIdx}
                    className={keyClass}
                    aria-label={ariaLabel}
                    data-long={longPressMappings[key] || undefined}
                    onMouseDown={(e) => handlePressStart(e, key)}
                    onTouchStart={(e) => handlePressStart(e, key)}
                    onMouseUp={(e) => handlePressEnd(e, key, label)}
                    onTouchEnd={(e) => handlePressEnd(e, key, label)}
                  >
                    {buttonContent}
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

      {showNotesDrawer && (
        <div className="notes-drawer-backdrop" onClick={() => setShowNotesDrawer(false)}>
          <div className="notes-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>Saved Notes</h2>
              <button className="btn-close-drawer" onClick={() => setShowNotesDrawer(false)}>✕</button>
            </div>
            
            <div className="notes-grid">
              {notes.length === 0 ? (
                <div className="empty-notes-message">
                  <p>No notes saved yet.</p>
                  <p className="subtext">Notes auto-save as you type.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`note-card note-bg-${note.color}`}
                    onClick={() => loadNote(note)}
                  >
                    <div className="note-card-header">
                      <h4>{note.title || "Untitled"}</h4>
                      <button
                        className="btn-card-delete"
                        onClick={(e) => deleteNote(note.id, e)}
                        aria-label="Delete note"
                        title="Delete Note"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                    <p className="note-card-content">{note.content || "Empty Note..."}</p>
                    <span className="note-card-date">
                      {new Date(note.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
