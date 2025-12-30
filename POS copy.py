# Standard Library
import os
import math
import random
import re
from collections import Counter, defaultdict
from itertools import combinations
import webbrowser
import unicodedata
import traceback

# GUI
import tkinter as tk
from tkinter import OptionMenu, ttk, filedialog, messagebox

# Data Processing
import pandas as pd
import numpy as np

# NLP
import nltk
from nltk.tokenize import word_tokenize
import stanza
from sklearn.feature_extraction.text import CountVectorizer

# Visualization - Matplotlib
import matplotlib.pyplot as plt
from matplotlib import font_manager, rcParams
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.font_manager import FontProperties
import matplotlib.patheffects as path_effects
import matplotlib.colors as mcolors
from matplotlib import cm
from adjustText import adjust_text
import matplotlib.font_manager as fm

# Visualization - WordCloud
from wordcloud import WordCloud

# Visualization - Plotly
import plotly.graph_objects as go

# Network Analysis
import networkx as nx
from networkx import DiGraph

# Arabic/Urdu Text Processing
import arabic_reshaper
from bidi.algorithm import get_display

# Image Processing
from PIL import Image, ImageOps

# Download NLTK data (keep this at the end)
nltk.download('punkt')

def tokenize(text):
    return re.findall(r'\w+', text)
1
# Load Stanza Urdu NLP Pipeline
try:
    nlp = stanza.Pipeline(lang='ur', processors='tokenize,pos', use_gpu=True)
except Exception as e:
    print(f"GPU not available, falling back to CPU: {e}")
    nlp = stanza.Pipeline(lang='ur', processors='tokenize,pos', use_gpu=False)
# Create main window
root = tk.Tk()
root.title("Urdu POS Tagger")
root.geometry("800x600")

# Global variable to store file content
file_content = ""

# Frame for file selection and execution
top_frame = tk.Frame(root)
top_frame.pack(pady=10)


# Function to select a file
def select_file():
    global file_content
    try:
        file_path = filedialog.askopenfilename(filetypes=[("Text files", "*.txt")])
        if file_path:
            with open(file_path, "r", encoding="utf-8") as file:
                file_content = file.read()
            file_name = os.path.basename(file_path)
            selected_file_label.config(text=f"Selected File: {file_name}")
            text_area.delete(1.0, tk.END)
            text_area.insert(tk.END, file_content)
    except Exception as e:
        selected_file_label.config(text=f"Error reading file: {e}", fg="red")

# Button to select file
# Instead of tk.Button
select_file_btn = ttk.Button(top_frame, text="Select File", command=select_file)
select_file_btn.pack(side="left", padx=5)

# Label to display the selected file name
selected_file_label = tk.Label(top_frame, text="No file selected", fg="blue")
selected_file_label.pack(side="left", padx=5)

# Function to execute the selected task
def execute_function():
    global file_content
    if not file_content or file_content.strip() == "":
        status_bar.config(text="Error: No text to process", fg="red")
        return

    # Call the process_text function to perform POS tagging
    process_text(file_content)

# Execute Button
execute_btn = tk.Button(top_frame, text="Execute", command=execute_function)
execute_btn.pack(side="left", padx=5)

# Text Area
text_area_frame = tk.Frame(root)
text_area_frame.pack(pady=10, fill="both", expand=True)

text_area_scroll = ttk.Scrollbar(text_area_frame, orient="vertical")
text_area_scroll.pack(side="right", fill="y")

text_area = tk.Text(text_area_frame, wrap="word", height=10, font=("Arial", 12))
text_area.pack(fill="both", expand=True)
text_area.config(yscrollcommand=text_area_scroll.set)
text_area_scroll.config(command=text_area.yview)

# Table Frame
table_frame = tk.Frame(root)
table_frame.pack(pady=10, fill="both", expand=True)

vert_scroll = ttk.Scrollbar(table_frame, orient="vertical")
vert_scroll.pack(side="right", fill="y")

hor_scroll = ttk.Scrollbar(table_frame, orient="horizontal")
hor_scroll.pack(side="bottom", fill="x")

tree = ttk.Treeview(
    table_frame,
    columns=("Before Words", "Word", "After Words", "POS Tag", "POS Type", "Frequency", "Percentage"),
    show="headings",
    yscrollcommand=vert_scroll.set,
    xscrollcommand=hor_scroll.set
)

# Attach Scrollbars to Treeview
vert_scroll.config(command=tree.yview)
hor_scroll.config(command=tree.xview)

# Add Column Headings
for col in tree["columns"]:
    tree.heading(col, text=col)
    tree.column(col, anchor="center", width=120)

tree.pack(fill="both", expand=True)

# Status Bar
status_bar = tk.Label(root, text="Ready", bd=1, relief=tk.SUNKEN, anchor=tk.W)
status_bar.pack(side=tk.BOTTOM, fill=tk.X)


                            
    
def clear_table():
    """Clear the Treeview with error handling and status updates"""
    try:
        status_bar.config(text="Clearing table...")
        tree.delete(*tree.get_children())  # More efficient bulk deletion
    except Exception as e:
        status_bar.config(text=f"Error clearing table: {str(e)}", fg="red")
    finally:
        status_bar.config(text="Ready")

def classify_pos(word, pos):
    """
    Enhanced POS classifier using consolidated POS_CATEGORIES
    Args:
        word: The Urdu word to classify
        pos: The basic POS tag from Stanza
    Returns:
        More specific POS category string
    """
    # Handle nouns with all subcategories
    if pos == "NOUN":
        for category in ["proper_nouns", "common_nouns", "abstract_nouns",
                       "verbal_nouns", "collective_nouns"]:
            if word in POS_CATEGORIES[category]:
                return category.replace("_", " ").title()
        return "Noun"
    
    # Enhanced verb classification
    elif pos == "VERB":
        if word in POS_CATEGORIES["helping_verbs"]:
            return "Helping Verb"
        elif word.endswith(('نا', 'نی', 'نے')):  # Infinitive forms
            return "Infinitive Verb"
        elif word.endswith(('تا', 'تی', 'تے')):  # Present tense
            return "Present Verb"
        else:
            return "Main Verb"
    
    # Other POS tags mapping
    pos_mapping = {
        "ADJ": "Adjective",
        "PRON": "Pronoun",
        "ADV": "Adverb",
        "DET": "Determiner",
        "NUM": "Number",
        "CONJ": "Conjunction",
        "PART": "Particle",
        "INTJ": "Interjection",
        "ADP": "Preposition",
        "AUX": "Auxiliary Verb"
    }
    
    return pos_mapping.get(pos, pos)  # Default fallback

def process_text(text):
    """Process text and display POS tagging results with context"""
    clear_table()
    try:
        doc = nlp(text)
        words = [(word.text, word.upos) for sentence in doc.sentences for word in sentence.words]
        word_counts = Counter(word for word, _ in words)
        
        # Prepare all data before insertion
        results = []
        for i, (word, pos) in enumerate(words):
            context_before = " ".join(w[0] for w in words[max(0,i-3):i]) or "-"
            context_after = " ".join(w[0] for w in words[i+1:i+4]) or "-"
            pos_type = classify_pos(word, pos)
            
            results.append((
                context_before,
                word,
                context_after,
                pos,
                pos_type,
                word_counts[word],
                f"{(word_counts[word]/len(words))*100:.2f}%"
            ))
        
        # Batch insert for better performance
        for row in results:
            tree.insert("", "end", values=row)
            
        status_bar.config(text=f"Processed {len(words)} words", fg="green")
        
    except Exception as e:
        status_bar.config(text=f"Processing error: {str(e)}", fg="red")

def normalize_urdu(text):
    """Normalize Urdu text by handling Unicode variations"""
    text = unicodedata.normalize('NFC', text)
    
    # Extended Urdu character replacements
    replacements = {
        'ٰ': '',   # Remove Arabic superscript alef
        'ھ': 'ہ',  # Unified h
        'ے': 'ی',  # Unified ye
        'ك': 'ک',  # Arabic kaf to Persian kaf
        'ى': 'ی',  # Arabic yeh to Persian yeh
        'ة': 'ہ',  # Arabic teh marbuta to heh
        '\u200c': ' ',  # Zero-width non-joiner to space
        '\u200d': '',   # Remove zero-width joiner
        '‘': "'", '’': "'", '“': '"', '”': '"'  # Standardize quotes
    }
    
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    return text.strip()

# Consolidated POS categories dictionary
POS_CATEGORIES = {
    "proper_nouns": {"پاکستان", "لاہور", "علی", "فاطمہ", "کراچی", "اسلام آباد"},
    "common_nouns": {"کتاب", "دروازہ", "لڑکا", "لڑکی", "گھر", "سڑک"},
    "abstract_nouns": {"محبت", "دوستی", "خوشی", "غم", "امید", "نفرت"},
    "verbal_nouns": {"لکھائی", "پڑھائی", "کھیل", "سوچ", "سمجھ", "دوڑ"},
    "collective_nouns": {"فوج", "جماعت", "خاندان", "ٹیم", "کلاس"},
    "helping_verbs": {"ہونا", "چاہنا", "سکنا", "پانا", "لگنا", "رہنا",
        "جانا", "دینا", "لینا", "کرنا", "چلنا", "آنا"
    }
}
def export_results():
    """Export Treeview data to CSV, Excel, or text file with comprehensive error handling"""
    file_types = [
        ("CSV Files", "*.csv"),
        ("Excel Files", "*.xlsx"), 
        ("Text Files", "*.txt")
    ]
    
    try:
        # Get save path from user
        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=file_types,
            title="Export POS Analysis Results"
        )
        
        if not file_path:  # User canceled
            return

        # Verify data exists
        data = [tree.item(row)["values"] for row in tree.get_children()]
        if not data:
            messagebox.showwarning("No Data", "There is no analysis data to export!")
            return

        # Prepare DataFrame with proper column validation
        columns = ["Before Words", "Word", "After Words", 
                  "POS Tag", "POS Type", "Frequency", "Percentage"]
        
        # Validate data structure
        if len(data[0]) != len(columns):
            messagebox.showerror("Export Error", 
                               "Data structure mismatch. Cannot export.")
            return

        df = pd.DataFrame(data, columns=columns)

        # Export based on file type
        if file_path.endswith(".csv"):
            df.to_csv(file_path, index=False, encoding="utf-8-sig")
        elif file_path.endswith(".xlsx"):
            df.to_excel(file_path, index=False, engine='openpyxl')
        elif file_path.endswith(".txt"):
            df.to_csv(file_path, sep="\t", index=False, encoding="utf-8-sig")
        else:
            messagebox.showerror("Error", "Unsupported file format")
            return

        # Success feedback
        messagebox.showinfo(
            "Export Successful",
            f"Data exported successfully to:\n{os.path.basename(file_path)}\n\n"
            f"• Total records: {len(data)}\n"
            f"• File size: {os.path.getsize(file_path)/1024:.1f} KB",
            parent=root
        )

    except PermissionError:
        messagebox.showerror(
            "Export Failed",
            "Permission denied. Please:\n"
            "1. Close the file if open\n"
            "2. Check write permissions\n"
            "3. Try a different location",
            parent=root
        )
    except Exception as e:
        messagebox.showerror(
            "Export Failed", 
            f"An unexpected error occurred:\n\n{str(e)}",
            parent=root
        )

# Create styled export button
export_button = ttk.Button(
    root,
    text="📤 Export Results",
    command=export_results,
    style="Accent.TButton"  # Use themed button
)
export_button.pack(pady=10, padx=5, fill=tk.X)



# Subcategory dropdown options - maintaining your exact requested types
noun_types = ["All Nouns", "Proper Nouns", "Common Nouns", "Abstract Nouns", 
              "Concrete Nouns", "Material Nouns", "Collective Nouns", "Verbal Nouns"]
pronoun_types = ["All Pronouns", "Personal Pronouns", "Demonstrative Pronouns", 
                "Relative Pronouns", "Interrogative Pronouns", "Reflexive Pronouns"]
adjective_types = ["All Adjectives", "Descriptive Adjective", "Quantitative Adjective", 
                  "Demonstrative Adjective", "Possessive Adjective", "Interrogative Adjective"]
adverb_types = ["All Adverbs", "Adverb of Time", "Adverb of Place", 
               "Adverb of Manner", "Adverb of Degree", "Adverb of Frequency"]
verb_types = ["All Verbs", "Main Verb", "Helping Verb", 
             "Transitive Verb", "Compound Verb", "Causative Verb", "Imperative Verb"]
conjunction_types = ["All Conjunctions", "Coordinating Conjunction", 
                    "Subordinating Conjunction", "Correlative Conjunction"]
preposition_types = ["All Prepositions", "Time Preposition", "Place Preposition", 
                    "Direction Preposition"]  # Added missing prepositions
concordance_types = ["All Pairs", "Noun+Noun", "Verb+Verb", 
                    "Adj+Noun", "Noun+Verb", "Pronoun+Verb"]
# Create subcategory dropdowns with default values
noun_type_var = tk.StringVar(value="Select Noun Type")
noun_type_menu = ttk.OptionMenu(top_frame, noun_type_var, "Select Noun Type", *noun_types)
noun_type_menu.pack_forget()

pronoun_type_var = tk.StringVar(value="Select Pronoun Type")
pronoun_type_menu = ttk.OptionMenu(top_frame, pronoun_type_var, "Select Pronoun Type", *pronoun_types)
pronoun_type_menu.pack_forget()

adjective_type_var = tk.StringVar(value="Select Adjective Type")
adjective_type_menu = ttk.OptionMenu(top_frame, adjective_type_var, "Select Adjective Type", *adjective_types)
adjective_type_menu.pack_forget()

adverb_type_var = tk.StringVar(value="Select Adverb Type")
adverb_type_menu = ttk.OptionMenu(top_frame, adverb_type_var, "Select Adverb Type", *adverb_types)
adverb_type_menu.pack_forget()

verb_type_var = tk.StringVar(value="Select Verb Type")
verb_type_menu = ttk.OptionMenu(top_frame, verb_type_var, "Select Verb Type", *verb_types)
verb_type_menu.pack_forget()

conjunction_type_var = tk.StringVar(value="Select Conjunction Type")
conjunction_type_menu = ttk.OptionMenu(top_frame, conjunction_type_var, "Select Conjunction Type", *conjunction_types)
conjunction_type_menu.pack_forget()

# --- N-gram Dropdown Button ---
# --- N-gram Dropdown Button (fixed) ---
ngram_button = tk.Menubutton(top_frame, text="N-gram Analysis", relief=tk.RAISED, direction="below")
ngram_menu = tk.Menu(ngram_button, tearoff=0)

# Add N-gram options
ngram_menu.add_command(label="Unigram", command=lambda: perform_ngram_analysis(1))
ngram_menu.add_command(label="Bigram", command=lambda: perform_ngram_analysis(2))
ngram_menu.add_command(label="Trigram", command=lambda: perform_ngram_analysis(3))
ngram_menu.add_command(label="4-gram", command=lambda: perform_ngram_analysis(4))
ngram_menu.add_command(label="5-gram", command=lambda: perform_ngram_analysis(5))

ngram_button.config(menu=ngram_menu)
ngram_button.pack(side="left", padx=5)



# Dropdown menu for POS categories
menu_var = tk.StringVar()
menu_var.set("POS Tags")  # Default value

# Bind dropdown selection to handle_selection()
menu_var.trace_add("write", lambda *args: handle_selection(menu_var.get()))

dropdown_menu = ttk.OptionMenu(
    top_frame, 
    menu_var, 
    "POS Tags", 
    "POS Tags", "Nouns", "Pronouns", "Adjectives",
    "Verbs", "Adverbs", "Conjunctions", "Prepositions"
)
dropdown_menu.pack(side="left", padx=5)



# Initialize Stanza pipeline for Urdu
nlp = stanza.Pipeline(lang='ur', processors='tokenize,pos')

# Urdu noun dictionary (categorized)
urdu_noun_dict = {
    "Proper Nouns": [
        "پاکستان", "لاہور", "کراچی", "اسلام آباد", "فیصل آباد", "قائداعظم", "علامہ اقبال",
        "نیویارک", "چین", "روس", "برطانیہ", "گاندھی", "مولانا رومی", "الطاف حسین",
        "نیلسن منڈیلا", "امریکہ", "ٹوکیو", "پیرس", "واشنگٹن", "شیکسپئیر", "اردو", "پنجابی"
    ],
    "Common Nouns": [
        "کتاب", "دروازہ", "بچہ", "لڑکی", "لڑکا", "گھر", "گلی", "سڑک", "سکول", "کالج"
    ],
    "Abstract Nouns": [
        "محبت", "دوستی", "علم", "ایمان", "خوشی", "غم", "نفرت", "عدل", "رحمت", "امید"
    ],
    "Collective Nouns": [
        "فوج", "مجمع", "کمیٹی", "کلاس", "ٹیم", "قوم", "برادری", "خاندان", "ممبر", "اساتذہ"
    ]
}

# Function to classify nouns
def classify_noun(word, doc=None):
    """Enhanced noun classifier with better rules and fallbacks"""
    # Proper noun check
    if doc:
        for sentence in doc.sentences:
            for w in sentence.words:
                if w.text == word and w.upos == "PROPN":
                    return "Proper Nouns"
    
    # Dictionary check (case-insensitive)
    lower_word = word.lower()
    for category, words in urdu_noun_dict.items():
        if any(lower_word == w.lower() for w in words):
            return category
    
    # Enhanced heuristic rules
    abstract_suffixes = ("یت", "گی", "پن", "ائی", "اوت", "انی", "والی")
    collective_suffixes = ("ات", "ج", "گروہ", "دلی", "والے")
    verbal_suffixes = ("نا", "ائی", "وانا", "ہنا")
    
    if word.endswith(abstract_suffixes):
        return "Abstract Nouns"
    elif word.endswith(collective_suffixes):
        return "Collective Nouns"
    elif word.endswith(verbal_suffixes):
        return "Verbal Nouns"
    elif word.endswith(("ی", "یا", "یہ", "نی", "انی", "ں", "وی")):
        return "Common Nouns"  # Feminine
    elif word.endswith(("ا", "ہ", "و", "ے", "ار")):
        return "Common Nouns"  # Masculine
    
    # Additional checks
    material_keywords = ("دھات", "معدن", "پتھر", "ریت", "تانبا")
    if any(kw in word for kw in material_keywords):
        return "Material Nouns"
    
    return "Concrete Nouns"

def show_nouns():
    clear_table()
    if not file_content.strip():
        status_bar.config(text="Error: No text to process", fg="red")
        return

    status_bar.config(text="Processing nouns...", fg="blue")
    try:
        doc = nlp(file_content)
        word_counts = Counter(word.text for sentence in doc.sentences for word in sentence.words if word.upos in ["NOUN", "PROPN"])
        total_nouns = sum(word_counts.values())
        
        if total_nouns == 0:
            status_bar.config(text="No nouns found.", fg="red")
            return

        pos_results = []
        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos in ["NOUN", "PROPN"]:
                    noun_class = classify_noun(word.text, doc)
                    before = " ".join(w.text for w in sentence.words[max(0, i-3):i]) or "-"
                    after = " ".join(w.text for w in sentence.words[i+1:i+4]) or "-"
                    frequency = word_counts[word.text]
                    percentage = round((frequency / total_nouns) * 100, 2) if total_nouns > 0 else 0
                    pos_results.append((before, word.text, after, word.upos, noun_class, frequency, f"{percentage}%"))
        
        for result in pos_results:
            tree.insert("", "end", values=result)
        
        status_bar.config(text=f"Found {total_nouns} nouns!", fg="green")
    except Exception as e:
        status_bar.config(text=f"Error: {e}", fg="red")

def show_nouns_by_type(*args):
    noun_type = noun_type_var.get()
    if noun_type in ["Select Noun Type", "", None]:
        return

    clear_table()
    if not file_content.strip():
        status_bar.config(text="Error: No text to process", fg="red")
        return

    status_bar.config(text=f"Processing {noun_type} nouns...", fg="blue")
    
    try:
        doc = nlp(file_content)
        word_counts = Counter(word.text for sentence in doc.sentences for word in sentence.words if word.upos in ["NOUN", "PROPN"])
        total_nouns = sum(word_counts.values())
        
        if total_nouns == 0:
            status_bar.config(text=f"No nouns found.", fg="red")
            return

        pos_results = []
        type_count = 0
        
        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos in ["NOUN", "PROPN"]:
                    noun_class = classify_noun(word.text, doc)
                    if noun_class == noun_type:
                        before = " ".join(w.text for w in sentence.words[max(0, i-3):i]) or "-"
                        after = " ".join(w.text for w in sentence.words[i+1:i+4]) or "-"
                        frequency = word_counts[word.text]
                        percentage = round((frequency / total_nouns) * 100, 2)
                        pos_results.append((before, word.text, after, word.upos, noun_class, frequency, f"{percentage}%"))
                        type_count += 1
        
        for result in pos_results:
            tree.insert("", "end", values=result)
        
        status_bar.config(text=f"Found {type_count} {noun_type} (out of {total_nouns} total nouns)", fg="green")
    except Exception as e:
        status_bar.config(text=f"Error: {e}", fg="red")

        
# Bind noun type dropdown to show_nouns_by_type
noun_type_var.trace("w", show_nouns_by_type)

                                
                                # Function to show Pronouns



def classify_pronoun(word):
    word = word.strip()
    word = re.sub(r'\s+', ' ', word)

    personal_pronouns = {"میں", "ہم", "تم", "وہ", "آپ", "تو"}
    possessive_pronouns = {"میرا", "ہمارا", "تمہارا", "ان کا", "اس کا", "تیرا", "اس"}  # Added 'اس'
    demonstrative_pronouns = {"یہ", "وہ", "یہ لوگ", "وہ لوگ", "یہاں", "وہاں", "اس"}  # Added 'اس'
    interrogative_pronouns = {"کون", "کیا", "کب", "کہاں", "کیوں", "کیسا", "کونسا", "کتنا"}
    relative_pronouns = {"جو", "جس", "جسے", "جس نے", "جس کا", "جس کے", "جن"}
    reflexive_pronouns = {"خود", "اپنے", "اپنا", "اپنی"}

    if word in personal_pronouns:
        return "Personal Pronouns"
    elif word in possessive_pronouns:
        return "Possessive Pronouns"
    elif word in demonstrative_pronouns:
        return "Demonstrative Pronouns"
    elif word in interrogative_pronouns:
        return "Interrogative Pronouns"
    elif word in relative_pronouns:
        return "Relative Pronouns"
    elif word in reflexive_pronouns:
        return "Reflexive Pronouns"
    else:
        return "Unknown"

def show_pronouns_by_type():
    # Clear the table before inserting new results
    tree.delete(*tree.get_children())  # ✅ Clears old entries efficiently

    try:
        doc = nlp(text_area.get("1.0", "end-1c"))

        pronoun_type_map = {
            "Personal Pronouns": "Personal Pronouns",
            "Possessive Pronouns": "Possessive Pronouns",
            "Demonstrative Pronouns": "Demonstrative Pronouns",
            "Interrogative Pronouns": "Interrogative Pronouns",
            "Relative Pronouns": "Relative Pronouns",
            "Reflexive Pronouns": "Reflexive Pronouns"
        }
        
        selected_type = pronoun_type_var.get()

        word_counts = Counter(word.text for sentence in doc.sentences for word in sentence.words if word.upos == "PRON")
        total_pronouns = sum(word_counts.values())

        if total_pronouns == 0:
            status_bar.config(text=f"No {selected_type} found.", fg="red")
            return

        pronoun_list = []
        for sentence in doc.sentences:
            for word in sentence.words:
                if word.upos == "PRON":
                    pronoun_class = classify_pronoun(word.text)
                    pronoun_list.append((word.text, pronoun_class))

        matching_pronouns = [word for word, p_type in pronoun_list if p_type == selected_type]

        if not matching_pronouns:
            status_bar.config(text=f"No {selected_type} found.", fg="red")
            return

        pos_results = []
        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos == "PRON":
                    pronoun_class = classify_pronoun(word.text)

                    if pronoun_class == selected_type:
                        before = " ".join(w.text for w in sentence.words[max(0, i-5):i]) if i > 0 else "-"
                        after = " ".join(w.text for w in sentence.words[i+1:i+6]) if i < len(sentence.words)-1 else "-"
                        frequency = word_counts.get(word.text, 0)
                        percentage = round((frequency / total_pronouns) * 100, 2) if total_pronouns > 0 else 0

                        pos_results.append((before, word.text, after, "PRON", pronoun_class, frequency, f"{percentage}%"))

        if not pos_results:
            status_bar.config(text=f"No {selected_type} found.", fg="red")
            return

        for before, word, after, pos_tag, pos_type, freq, perc in pos_results:
            tree.insert("", "end", values=(before, word, after, pos_tag, pos_type, freq, perc))

        status_bar.config(text=f"{selected_type} extracted!", fg="green")

    except Exception as e:
        status_bar.config(text=f"Error: {e}", fg="red")


# ✅ **Ensure correct dropdown binding**
pronoun_type_var.trace("w", lambda var, index, mode: show_pronouns_by_type())





                            # Function to show adjective


# Function to classify adjectives

def classify_adjective(word):
    word = word.strip()
    word = re.sub(r'\s+', ' ', word)

    descriptive_adjectives = {
    "خوبصورت", "بہت خوب", "شاندار", "عظیم", "بدصورت", "پیارا", "سجیلا", "حسین", "دھندلا", "چمکدار",
    "سرد", "گرم", "نرم", "سخت", "بھاری", "ہلکا", "اونچا", "نیچا", "صاف", "گندا", "پرانا", "نیا",
    "تیز", "آہستہ", "چھوٹا", "بڑا", "لمبا", "موٹا", "پتلا", "خوشبو دار", "بدبو دار", "مدھم", "روشن",
    "پرسکون", "پریشان", "خوش", "اداس", "غصہ ور", "بے چین", "چالاک", "سست", "خاموش", "باتونی"
}
    quantitative_adjectives = {
    "کچھ", "کئی", "تھوڑا", "زیادہ", "کم", "مکمل", "نصف", "چوتھائی", "ادھا", "پورا",
    "ہزار", "سو", "دس", "لاکھ", "کروڑ", "ملین", "ارب", "دوگنا", "تگنا", "چند",
    "بہت", "سارا", "تمام", "ہر", "کوئی", "کسی", "ہر ایک", "آدھا", "ایک چوتھائی", "بہت زیادہ",
    "کم و بیش", "زیادہ تر", "معمولی", "مخصوص", "نایاب", "عام", "خالص", "جزوی", "بنیادی", "اضافی"
}
    demonstrative_adjectives = {
    "یہ", "وہ", "یہاں", "وہاں", "اس", "ان", "اسے", "انہیں", "یہی", "وہی",
    "اِدھر", "اُدھر", "اِسی", "اُسی", "یہاں کا", "وہاں کا", "یہ سب", "وہ سب", "یہ چیز", "وہ چیز",
    "یہ وقت", "وہ وقت", "یہ موقع", "وہ موقع", "یہاں کی", "وہاں کی", "اس وقت", "ان لمحوں", "یہی راستہ", "وہی راستہ",
    "یہ حال", "وہ حال", "یہ حالت", "وہ حالت", "یہ احساس", "وہ احساس", "یہ دنیا", "وہ دنیا", "یہ خبر", "وہ خبر"
}
    interrogative_adjectives = {
    "کونسا", "کونسی", "کونسے", "کیا", "کیسا", "کیسی", "کیسے", "کتنا", "کتنی", "کتنے",
    "کس قسم کا", "کس طرح", "کون", "کیوں", "کہاں", "کس جگہ", "کس شہر", "کس ملک", "کس حال میں", "کس وجہ سے",
    "کونسی کتاب", "کونسی فلم", "کونسا راستہ", "کونسا مشورہ", "کیا خبر", "کیا حال", "کیسا موسم", "کیسی خوشبو", "کیسا تجربہ", "کیسے خواب",
    "کتنا وقت", "کتنی دیر", "کتنا لمبا", "کتنا چھوٹا", "کتنا مہنگا", "کتنی قیمت", "کتنا اچھا", "کتنا برا", "کتنی مقدار", "کتنی ضرورت"}
    possessive_adjectives = {
    "میرا", "تمہارا", "ہمارا", "اس کا", "ان کا", "تیرا", "آپ کا", "ان سب کا", "اس کی", "ان کی",
    "میری", "تیری", "ہماری", "تمہاری", "اس کے", "ان کے", "میری چیز", "تیری کتاب", "ہمارے دوست", "تمہاری گاڑی",
    "اس کا گھر", "ان کے والدین", "میری بہن", "تمہاری بہن", "ہمارا ملک", "اس کی دوکان", "ان کا کاروبار", "تمہارا حق", "میرا خواب", "ہمارے اصول",
    "اس کی محنت", "ان کی کوشش", "میری زندگی", "تمہاری خوشی", "ہمارا مستقبل", "میری کہانی", "تمہارا مشورہ", "ہمارے اصول", "ان کے خیالات", "ہمارے خیالات"
}

    if word in descriptive_adjectives:
        return "Descriptive Adjective"
    elif word in quantitative_adjectives:
        return "Quantitative Adjective"
    elif word in demonstrative_adjectives:
        return "Demonstrative Adjective"
    elif word in interrogative_adjectives:
        return "Interrogative Adjective"
    elif word in possessive_adjectives:
        return "Possessive Adjective"
    else:
        return "Unknown"

def show_adjectives_by_type():
    tree.delete(*tree.get_children())  # Clear previous results
    
    try:
        doc = nlp(text_area.get("1.0", "end-1c"))

        adjective_type_map = {
            "Descriptive Adjective": "Descriptive Adjective",
            "Quantitative Adjective": "Quantitative Adjective",
            "Demonstrative Adjective": "Demonstrative Adjective",
            "Interrogative Adjective": "Interrogative Adjective",
            "Possessive Adjective": "Possessive Adjective"
        }
        
        selected_type = adjective_type_var.get()
        
        word_counts = Counter(word.text for sentence in doc.sentences for word in sentence.words if word.upos == "ADJ")
        total_adjectives = sum(word_counts.values())
        
        if total_adjectives == 0:
            status_bar.config(text=f"No {selected_type} found.", fg="red")
            return
        
        adjective_list = []
        for sentence in doc.sentences:
            for word in sentence.words:
                if word.upos == "ADJ":
                    adj_class = classify_adjective(word.text)
                    adjective_list.append((word.text, adj_class))
        
        matching_adjectives = [word for word, adj_type in adjective_list if adj_type == selected_type]
        
        if not matching_adjectives:
            status_bar.config(text=f"No {selected_type} found.", fg="red")
            return
        
        pos_results = []
        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos == "ADJ":
                    adj_class = classify_adjective(word.text)

                    if adj_class == selected_type:
                        before = " ".join(w.text for w in sentence.words[max(0, i-5):i]) if i > 0 else "-"
                        after = " ".join(w.text for w in sentence.words[i+1:i+6]) if i < len(sentence.words)-1 else "-"
                        frequency = word_counts.get(word.text, 0)
                        percentage = round((frequency / total_adjectives) * 100, 2) if total_adjectives > 0 else 0

                        pos_results.append((before, word.text, after, "ADJ", adj_class, frequency, f"{percentage}%"))
        
        if not pos_results:
            status_bar.config(text=f"No {selected_type} found.", fg="red")
            return
        
        for before, word, after, pos_tag, pos_type, freq, perc in pos_results:
            tree.insert("", "end", values=(before, word, after, pos_tag, pos_type, freq, perc))

        status_bar.config(text=f"{selected_type} extracted!", fg="green")
    
    except Exception as e:
        status_bar.config(text=f"Error: {e}", fg="red")

# Bind dropdown selection to function call
adjective_type_var.trace("w", lambda var, index, mode: show_adjectives_by_type())


                               
                                # Function to show Verbs

# Verb classification function (matches your existing style)
def classify_verb(word):
    word = word.strip()
    word = re.sub(r'\s+', ' ', word)

    # Define verb categories
    helping_verbs = {
        "ہے", "ہیں", "ہو", "تھا", "تھی", "تھے", "ہوگا", "ہوگی", "ہوں گے",
        "رہا", "رہی", "رہے", "چاہیے", "چاہتا", "چاہتی", "چاہتے", "سکتا", 
        "سکتی", "سکتے", "پڑا", "پڑی", "پڑے", "دیا", "دی", "دے", "لیا", "لی",
        "لے", "کیا", "کر", "کرو", "کریں", "ہوئے", "ہوا", "ہوئی"
    }

    transitive_verbs = {
        "لکھ", "پڑھ", "کھا", "پی", "دیکھ", "سن", "خرید", "بیچ", "مار",
        "پکڑ", "کھول", "بند", "بنا", "توڑ", "لے", "دو", "دی", "لی", "کی",
        "دیا", "کہا", "سمجھ", "بتا", "لکھو", "پڑھو", "کھاؤ", "پیو", "دیکھو"
    }

    compound_verbs = {
        "کر دیا", "کر لی", "ہو گیا", "لے آ", "لے جا", "پکڑ لیا", "مار ڈالا",
        "کھا لیا", "پی لیا", "بنا دیا", "چلا گیا", "آ گیا", "چلے گئے"
    }

    # Classification logic
    if word in compound_verbs:
        return "Compound Verb"
    elif word in helping_verbs:
        return "Helping Verb"
    elif word in transitive_verbs:
        return "Transitive Verb"
    elif re.search(r'(نا|نی|نے)$', word):
        return "Main Verb"
    elif re.search(r'(و|ئے|یں)$', word):
        return "Imperative Verb"
    elif re.search(r'(وا|ائی|ائے)$', word):
        return "Causative Verb"
    else:
        return "Main Verb"  # Default classification

# Verb display function
def show_verbs_by_type(*args):
    tree.delete(*tree.get_children())  # Clear previous results
    
    try:
        doc = nlp(text_area.get("1.0", "end-1c"))
        selected_type = verb_type_var.get()
        
        if selected_type == "Select Verb Type":
            return

        # Get all verbs and their classifications
        all_verbs = []
        for sentence in doc.sentences:
            for word in sentence.words:
                if word.upos == "VERB":
                    verb_class = classify_verb(word.text)
                    all_verbs.append((word.text, verb_class))
        
        if not all_verbs:
            status_bar.config(text="No verbs found in text", fg="red")
            return

        # Count frequencies
        verb_counts = Counter(v[0] for v in all_verbs)
        total_verbs = len(all_verbs)

        # Filter and display results
        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos == "VERB":
                    verb_class = classify_verb(word.text)
                    
                    if verb_class == selected_type or selected_type == "All Verbs":
                        before = " ".join(w.text for w in sentence.words[max(0,i-3):i]) or "-"
                        after = " ".join(w.text for w in sentence.words[i+1:i+4]) or "-"
                        freq = verb_counts[word.text]
                        percentage = (freq / total_verbs) * 100 if total_verbs > 0 else 0

                        tree.insert("", "end", values=(
                            before,
                            word.text,
                            after,
                            "VERB",
                            verb_class,
                            freq,
                            f"{percentage:.1f}%"
                        ))

        status_bar.config(
            text=f"Showing {sum(1 for v in all_verbs if v[1] == selected_type or selected_type == 'All Verbs')} verbs",
            fg="green"
        )

    except Exception as e:
        status_bar.config(text=f"Error: {str(e)}", fg="red")

# UI Setup (add this to your existing UI code)
verb_types = ["All Verbs", "Main Verb", "Helping Verb", "Transitive Verb", 
              "Compound Verb", "Causative Verb", "Imperative Verb"]

verb_type_var = tk.StringVar(value="Select Verb Type")
verb_type_menu = ttk.OptionMenu(
    top_frame,  # Changed from root to top_frame
    verb_type_var, 
    "Select Verb Type", 
    *verb_types
)
verb_type_menu.pack(side="left", padx=5)  # Same packing as other menus
verb_type_var.trace("w", show_verbs_by_type)
                               
                                # Function to show adVerbs


def classify_adverb(word):
    word = word.strip()
    word = re.sub(r'[\s\u200c]+', ' ', word)  # Normalize spaces

    # Adverb dictionaries
    time_adverbs = {
        "آج", "کل", "پرسوں", "اب", "پہلے", "بعد", "جلد", "دیر", "ہمیشہ",
        "کبھی", "اکثر", "بعض اوقات", "فوراً", "ابھی", "تھوڑی دیر", "رات", "دن"
    }
    
    place_adverbs = {
        "یہاں", "وہاں", "ادھر", "اُدھر", "آس پاس", "نیچے", "اوپر", "باہر",
        "اندر", "قریب", "دور", "سامنے", "پیچھے", "بائیں", "دائیں", "ہر جگہ"
    }
    
    manner_adverbs = {
        "اچھی طرح", "بری طرح", "تیزی", "آہستگی", "خاموشی", "زور", "پوری طرح",
        "صاف", "غلط", "درست", "عجیب", "حقیقتاً", "یقیناً", "شاید", "مکمل"
    }
    
    degree_adverbs = {
        "بہت", "نہایت", "انتہائی", "کافی", "تھوڑا", "بالکل", "تقریباً", "صرف",
        "خاص", "زیادہ", "کم", "ہلکا", "ذرا", "مکمل", "نصف", "پورا"
    }
    
    frequency_adverbs = {
        "ہمیشہ", "اکثر", "عام طور", "کبھی کبھی", "شاذ", "نادر", "بار بار",
        "مسلسل", "تھوڑی تھوڑی دیر", "روزانہ", "ہفتہ وار", "ماہانہ", "سالانہ"
    }

    # Classification logic
    if word in time_adverbs:
        return "Adverb of Time"
    elif word in place_adverbs:
        return "Adverb of Place"
    elif word in manner_adverbs:
        return "Adverb of Manner"
    elif word in degree_adverbs:
        return "Adverb of Degree"
    elif word in frequency_adverbs:
        return "Adverb of Frequency"
    else:
        return "Adverb"  # Default for unclassified adverbs

def show_adverbs_by_type(*args):
    tree.delete(*tree.get_children())  # Clear previous results
    
    try:
        doc = nlp(text_area.get("1.0", "end-1c"))
        selected_type = adverb_type_var.get()
        
        if selected_type == "Select Adverb Type":
            return

        # Get all adverbs and their classifications
        all_adverbs = []
        for sentence in doc.sentences:
            for word in sentence.words:
                if word.upos == "ADV":
                    adverb_class = classify_adverb(word.text)
                    all_adverbs.append((word.text, adverb_class))
        
        if not all_adverbs:
            status_bar.config(text="No adverbs found in text", fg="red")
            return

        # Count frequencies
        adverb_counts = Counter(v[0] for v in all_adverbs)
        total_adverbs = len(all_adverbs)

        # Filter and display results
        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos == "ADV":
                    adverb_class = classify_adverb(word.text)
                    
                    if adverb_class == selected_type or selected_type == "All Adverbs":
                        before = " ".join(w.text for w in sentence.words[max(0,i-3):i]) or "-"
                        after = " ".join(w.text for w in sentence.words[i+1:i+4]) or "-"
                        freq = adverb_counts[word.text]
                        percentage = (freq / total_adverbs) * 100 if total_adverbs > 0 else 0

                        tree.insert("", "end", values=(
                            before,
                            word.text,
                            after,
                            "ADV",
                            adverb_class,
                            freq,
                            f"{percentage:.1f}%"
                        ))

        status_bar.config(
            text=f"Showing {sum(1 for v in all_adverbs if v[1] == selected_type or selected_type == 'All Adverbs')} adverbs",
            fg="green"
        )

    except Exception as e:
        status_bar.config(text=f"Error: {str(e)}", fg="red")

# Add to your UI setup (with other dropdowns)
adverb_types = [
    "All Adverbs",
    "Adverb of Time", 
    "Adverb of Place",
    "Adverb of Manner",
    "Adverb of Degree",
    "Adverb of Frequency"
]

adverb_type_var = tk.StringVar(value="Select Adverb Type")
adverb_type_menu = ttk.OptionMenu(
    top_frame,
    adverb_type_var,
    "Select Adverb Type",
    *adverb_types
)
adverb_type_menu.pack(side="left", padx=5)
adverb_type_var.trace("w", show_adverbs_by_type)


                            #  Function to show Prepositions
                            
def classify_preposition(word):
    """Classify the given word into the correct preposition type."""
    word = word.strip()
    word = re.sub(r'[\s\u200c]+', ' ', word)  # Normalize spaces

    # Preposition categories
    time_prepositions = {"تک", "پہلے", "بعد", "کے دوران", "کے بعد", "کے پہلے", "کے وقت", "کے لیے", "کے اندر", "کے باہر"}
    place_prepositions = {"پر", "میں", "کے نیچے", "کے اوپر", "کے پاس", "کے قریب", "کے سامنے", "کے پیچھے", "کے اندر", "کے باہر", "کے درمیان", "کے آس پاس"}
    direction_prepositions = {"کی طرف", "کی جانب", "کے رخ", "کے لیے", "سے", "تک", "کے اوپر", "کے نیچے", "کے اندر", "کے باہر"}

    # Determine preposition category
    categories = set()
    if word in time_prepositions:
        categories.add("Time Preposition")
    if word in place_prepositions:
        categories.add("Place Preposition")
    if word in direction_prepositions:
        categories.add("Direction Preposition")

    return ", ".join(categories) if categories else "Preposition"  # Default if unclassified


def show_prepositions_by_type(*args):
    """Display prepositions based on the selected subcategory."""
    selected_type = preposition_type_var.get()
    if selected_type == "Select Preposition Type":
        return

    tree.delete(*tree.get_children())  # Clear previous results

    try:
        doc = nlp(text_area.get("1.0", tk.END).strip())
        preposition_counts = Counter()
        preposition_data = []

        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos == "ADP":  # 'ADP' is the POS tag for prepositions
                    prep_class = classify_preposition(word.text)
                    
                    if selected_type == "All Prepositions" or selected_type in prep_class:
                        before = " ".join(w.text for w in sentence.words[max(0, i - 3):i]) or "-"
                        after = " ".join(w.text for w in sentence.words[i + 1:i + 4]) or "-"
                        preposition_counts[word.text] += 1
                        preposition_data.append((before, word.text, after, prep_class))

        total_preps = sum(preposition_counts.values())

        if not preposition_data:
            status_bar.config(text="No prepositions found", fg="red")
            return

        # Display prepositions sorted by frequency
        for before, prep, after, prep_class in sorted(preposition_data, key=lambda x: preposition_counts[x[1]], reverse=True):
            freq = preposition_counts[prep]
            percentage = (freq / total_preps) * 100 if total_preps else 0

            tree.insert("", tk.END, values=(before, prep, after, "PREP", prep_class, freq, f"{percentage:.1f}%"))

        status_bar.config(text=f"Showing {len(preposition_data)} prepositions", fg="green")

    except Exception as e:
        status_bar.config(text=f"Error: {str(e)}", fg="red")


# 🔹 Add Prepositions to Dropdown UI
preposition_types = [
    "All Prepositions",
    "Time Preposition",
    "Place Preposition",
    "Direction Preposition",
    "Preposition"  # Default unclassified
]

preposition_type_var = tk.StringVar(value="Select Preposition Type")
preposition_type_menu = ttk.OptionMenu(
    top_frame,
    preposition_type_var,
    "Select Preposition Type",
    *preposition_types,
    command=show_prepositions_by_type
)
preposition_type_menu.pack_forget()  # Initially hidden


# 🔹 Improved `handle_selection` Function
def handle_selection(choice):
    """Show the relevant dropdown menu when a category is selected."""
    for menu in dropdown_menus.values():
        menu.pack_forget()  # Hide all subcategory menus

    if choice in dropdown_menus:
        dropdown_menus[choice].pack(side="left", padx=5)
    elif choice == "POS Tags":
        if "file_content" in globals() and file_content:
            process_text(file_content)
        else:
            messagebox.showerror("Error", "No file loaded!")


# 🔹 Update Main Dropdown to Include Prepositions
dropdown_menus = {
    "Nouns": noun_type_menu,
    "Pronouns": pronoun_type_menu,
    "Adjectives": adjective_type_menu,
    "Adverbs": adverb_type_menu,
    "Verbs": verb_type_menu,
    "Conjunctions": conjunction_type_menu,
    "Prepositions": preposition_type_menu
}

dropdown_menu = ttk.OptionMenu(
    top_frame, 
    menu_var, 
    "POS Tags", 
    *dropdown_menus.keys(),  # Dynamically add all categories
    command=handle_selection
)

# Function to show COnjunctions

def classify_conjunction(word):
    word = word.strip()
    word = re.sub(r'[\s\u200c]+', ' ', word)  # Normalize spaces

    # Conjunction dictionaries
    coordinating_conj = {
        "اور", "یا", "لیکن", "مگر", "پھر", "بلکہ", "و", "یا پھر", 
        "نہ", "نہ کہ", "یا تو", "نہ ہی"
    }
    
    subordinating_conj = {
        "کیونکہ", "اگر", "جب", "جبکہ", "تاکہ", "کہ", "جیسا", "جیسے", 
        "اگرچہ", "حالانکہ", "تو", "ورنہ", "چونکہ", "جتنا", "جس", "جب تک",
        "اگر ایسا", "حالانکہ", "باوجود", "اگر ہو"
    }
    
    correlative_conj = {
        "نہ صرف...بلکہ", "یا تو...یا", "جتنا...اتنا", "نا...نا",
        "خواہ...خواہ", "چاہے...چاہے", "نہ ہی...نہ ہی", "ہاں...مگر"
    }

    # Classification logic
    if word in coordinating_conj:
        return "Coordinating Conjunction"
    elif word in subordinating_conj:
        return "Subordinating Conjunction"
    elif any(conj in word for conj in correlative_conj):
        return "Correlative Conjunction"
    else:
        return "Other Conjunction"  # Changed from just "Conjunction"

def show_conjunctions_by_type(*args):
    selected_type = conjunction_type_var.get()
    if selected_type == "Select Conjunction Type":
        return

    tree.delete(*tree.get_children())  # Clear previous results
    
    try:
        doc = nlp(text_area.get("1.0", tk.END).strip())  # Changed to tk.END
        all_conjunctions = []
        
        # First pass to count frequencies
        for sentence in doc.sentences:
            for word in sentence.words:
                if word.upos in ("CCONJ", "SCONJ"):
                    conj_class = classify_conjunction(word.text)
                    all_conjunctions.append((word.text, conj_class))
        
        if not all_conjunctions:
            status_bar.config(text="No conjunctions found", fg="red")
            return

        conj_counts = Counter(v[0] for v in all_conjunctions)
        total_conj = len(all_conjunctions)

        # Second pass to display with context
        for sentence in doc.sentences:
            for i, word in enumerate(sentence.words):
                if word.upos in ("CCONJ", "SCONJ"):
                    conj_class = classify_conjunction(word.text)
                    
                    if selected_type == "All Conjunctions" or conj_class == selected_type:
                        before = " ".join(w.text for w in sentence.words[max(0,i-3):i]) or "-"
                        after = " ".join(w.text for w in sentence.words[i+1:i+4]) or "-"
                        freq = conj_counts[word.text]
                        percentage = (freq / total_conj) * 100 if total_conj > 0 else 0

                        tree.insert("", tk.END, values=(  # Changed to tk.END
                            before,
                            word.text,
                            after,
                            "CONJ",
                            conj_class,
                            freq,
                            f"{percentage:.1f}%"
                        ))

        shown_count = sum(1 for v in all_conjunctions 
                         if selected_type == "All Conjunctions" or v[1] == selected_type)
        status_bar.config(text=f"Showing {shown_count} conjunctions", fg="green")

    except Exception as e:
        status_bar.config(text=f"Error: {str(e)}", fg="red")

# UI Setup
conjunction_types = [
    "All Conjunctions",
    "Coordinating Conjunction", 
    "Subordinating Conjunction",
    "Correlative Conjunction",
    "Other Conjunction"  # Added this option
]

conjunction_type_var = tk.StringVar(value="Select Conjunction Type")
conjunction_type_menu = ttk.OptionMenu(
    top_frame,
    conjunction_type_var,
    "Select Conjunction Type",
    *conjunction_types,
    command=show_conjunctions_by_type  # Added direct command binding
)
conjunction_type_menu.pack(side="left", padx=5)

                    # Function to show Verbs


def show_verbs():
    clear_table()
    if not file_content:
        status_bar.config(text="Error: No text to process", fg="red")
        return  

    status_bar.config(text="Processing verbs...", fg="blue")

    try:
        # Define helping and main verbs
        helping_verbs = {
            "ہونا", "چاہنا", "سکنا", "پانا", "لگنا", "رہنا", "جانا", "دینا", 
            "لینا", "کرنا", "چلنا", "آنا", "رکھنا", "دیکھنا", "بننا", "پڑنا", 
            "چھوڑنا", "سمجھنا", "ماننا", "جاننا", "پوچھنا", "بتانا", "دھونا", 
            "اٹھانا", "جھکنا", "دوڑنا", "بھولنا", "یاد رکھنا", "محسوس کرنا", 
            "بولنا", "ہنسنا", "روکنا", "چھپانا", "چمکنا", "کاٹنا", "پہنچنا", 
            "سمیٹنا", "پھیلانا", "چمکانا", "نہانا", "گھمانا", "کھینچنا", 
            "پھینکنا", "ٹھیک کرنا", "بچانا", "سمجھانا", "پکڑنا", "دھکیلنا", 
            "زور دینا"
        }

        main_verbs = {
            "پڑھنا", "لکھنا", "سونا", "جاگنا", "کھانا", "پینا", "دیکھنا",
            "سننا", "چلنا", "دوڑنا", "بیٹھنا", "اٹھنا", "سمجھنا", "سوچنا",
            "محسوس کرنا", "بولنا", "پوچھنا", "سمیٹنا", "پھیلانا", "کاٹنا",
            "چمکنا", "چھپانا", "ہنسنا", "روکنا", "پہنچنا", "نہانا", "جھکنا",
            "دھونا", "پکڑنا", "گھمانا", "کھینچنا", "پھینکنا", "بتانا", 
            "زور دینا", "پڑھ لینا", "دیکھ لینا", "کھا لینا", "سنو لینا", 
            "کر لینا", "چل پڑنا", "بیٹھ جانا", "چھوڑ دینا", "یاد رکھنا", 
            "مان لینا", "نہ ماننا", "سوچنا", "سمجھ لینا", "محسوس کر لینا", 
            "ٹھیک کرنا"
        }

        # Get selected verb type from dropdown
        selected_verb_type = verb_type_var.get()

        # Process text using Stanza
        doc = nlp(file_content)
        pos_results = []
        words = [(word.text, word.upos) for sentence in doc.sentences for word in sentence.words]

        # Count total words and verb frequency
        total_words = len(words)
        verb_counts = Counter(word for word, pos in words if pos == "VERB")

        # Extract verbs based on selection
        for i, (word, pos) in enumerate(words):
            if pos == "VERB":
                before = " ".join(w[0] for w in words[max(0, i-5):i]) if i > 0 else "-"
                after = " ".join(w[0] for w in words[i+1:i+6]) if i < len(words)-1 else "-"
                frequency = verb_counts[word]
                percentage = (frequency / total_words) * 100 if total_words > 0 else 0

                # Determine verb type
                if word in helping_verbs:
                    verb_type = "مددگار فعل"  # Helping Verb
                elif word in main_verbs:
                    verb_type = "اصل فعل"  # Main Verb
                else:
                    verb_type = "فعل"

                # Filtering based on user selection
                if selected_verb_type == "Select Verb Type" or selected_verb_type == verb_type:
                    pos_results.append((before, word, after, verb_type, frequency, f"{percentage:.2f}%"))

        # Insert filtered results into the table
        for before, word, after, pos, frequency, percentage in pos_results:
            tree.insert("", "end", values=(before, word, after, pos, frequency, percentage))

        status_bar.config(text="Verbs extracted successfully!", fg="green")
    
    except Exception as e:
        status_bar.config(text=f"Error: {e}", fg="red")
        

# #Function For N_gram
# # Function For N-gram
# def perform_ngram_analysis(n):
#     global file_content
#     if not file_content.strip():
#         status_bar.config(text="Error: No text to process", fg="red")
#         return

#     words = nltk.word_tokenize(file_content)  # You can use your own Urdu tokenizer here
#     ngrams = list(nltk.ngrams(words, n))
#     freq_dist = Counter(ngrams)

#     total_ngrams = sum(freq_dist.values())

#     # Clear the existing table
#     for item in tree.get_children():
#         tree.delete(item)

#     for ngram, freq in freq_dist.most_common():
#         ngram_str = ' '.join(ngram)  # Convert tuple to string
#         percent = round((freq / total_ngrams) * 100, 2)  # Calculate percentage
#         tree.insert('', 'end', values=(
#             '',              # Before Words (empty)
#             ngram_str,       # Word (main n-gram)
#             '',              # After Words (empty)
#             f"{n}-gram",     # POS Tag
#             f"{n}-gram",     # POS Type
#             freq,
#             percent
#         ))

#     status_bar.config(text=f"{n}-gram analysis complete", fg="green")


#  #Graph Display#


# def generate_word_frequency_chart():
#     """Enhanced word frequency visualization with radio button selection and frequency filter (WordCloud only)"""
#     try:
#         table_words = [tree.item(item)['values'][1] for item in tree.get_children()]
#         if not table_words:
#             status_bar.config(text="No words in table to visualize", fg="red")
#             return

#         # Setup option window
#         option_window = tk.Toplevel()
#         option_window.title("Visualization Options")
#         option_window.geometry("350x200")

#         chart_type = tk.StringVar(value="wordcloud")  # only wordcloud works now
#         min_freq = tk.IntVar(value=1)

#         tk.Label(option_window, text="Choose Chart Type:").pack(pady=5)
#         tk.Radiobutton(option_window, text="Word Cloud", variable=chart_type, value="wordcloud").pack(anchor="w")
#         # Bar chart removed from GUI

#         tk.Label(option_window, text="Minimum Frequency:").pack(pady=10)
#         freq_entry = tk.Entry(option_window, textvariable=min_freq)
#         freq_entry.pack()

#         def proceed_visualization():
#             selected_chart = chart_type.get()
#             freq = min_freq.get()

#             option_window.destroy()

#             # Filter frequencies
#             word_freq = Counter(table_words)
#             filtered_freq = {w: c for w, c in word_freq.items() if c >= freq}
#             if not filtered_freq:
#                 status_bar.config(text="No words meet the minimum frequency", fg="red")
#                 return

#             # Prepare Urdu reshaping
#             def prepare_urdu_text(text):
#                 reshaped = arabic_reshaper.reshape(text)
#                 return get_display(reshaped)

#             reshaped_freq = {prepare_urdu_text(w): c for w, c in filtered_freq.items()}

#             # Random color map
#             colormaps = ['viridis', 'plasma', 'inferno', 'magma', 'cividis', 'Set1', 'Accent']
#             cmap_choice = random.choice(colormaps)

#             viz_window = tk.Toplevel()
#             viz_window.title("Words Frequency Visualization")
#             viz_window.geometry("950x650")

#             fig = plt.Figure(figsize=(8, 6), dpi=100)
#             ax = fig.add_subplot(111)

#             if selected_chart == "wordcloud":
#                 wordcloud = WordCloud(
#                     font_path="arial.ttf",  # Change to proper Urdu font
#                     width=800,
#                     height=400,
#                     background_color='white',
#                     colormap=cmap_choice,
#                     max_words=100,
#                     relative_scaling=0.8,
#                     min_font_size=10,
#                     collocations=False
#                 ).generate_from_frequencies(reshaped_freq)

#                 ax.imshow(wordcloud, interpolation='bilinear')
#                 ax.axis("off")
#                 ax.set_title("Word Cloud (Urdu)", pad=20, fontsize=14)
                
#             canvas = FigureCanvasTkAgg(fig, master=viz_window)
#             canvas.draw()
#             canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)

#             def save_image():
#                 file_path = filedialog.asksaveasfilename(defaultextension=".png",
#                                                          filetypes=[("PNG files", "*.png")])
#                 if file_path:
#                     fig.savefig(file_path, dpi=300, bbox_inches='tight')
#                     messagebox.showinfo("Saved", f"Visualization saved to:\n{file_path}")

#             save_btn = tk.Button(viz_window, text="Save Visualization", command=save_image,
#                                  bg="#4CAF50", fg="white")
#             save_btn.pack(pady=10)

#             status_bar.config(text="Urdu word cloud generated", fg="green")

#         tk.Button(option_window, text="Generate", command=proceed_visualization,
#                   bg="#2196F3", fg="white").pack(pady=10)

#     except Exception as e:

#         traceback.print_exc()
#         status_bar.config(text=f"Error: {str(e)}", fg="red")

# #___________def generate_bibliometric_network():____________


# def generate_bibliometric_network():
#     try:
#         # Extract and clean words (ignore punctuation)
#         def clean_word(word):
#             if not isinstance(word, str):
#                 return ""
#             # Remove punctuation (keep Urdu/Arabic characters)
#             cleaned = re.sub(r'[^\w\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]', '', word)
#             return cleaned.strip()

#         # Track words and their contexts
#         table_words = []
#         word_contexts = defaultdict(list)
        
#         for item in tree.get_children():
#             try:
#                 values = tree.item(item)['values']
#                 if len(values) > 1 and values[1]:
#                     word = clean_word(str(values[1]))
#                     if word:
#                         table_words.append(word)
#                         context = str(values[0]).split()
#                         word_contexts[word].extend([clean_word(w) for w in context if clean_word(w) != word])
#             except:
#                 continue

#         if not table_words:
#             status_bar.config(text="No valid words in table to visualize", fg="red")
#             return

#         word_freq = Counter(table_words)
#         if len(word_freq) < 2:
#             status_bar.config(text="Not enough unique words for network", fg="red")
#             return

#         # Calculate co-occurrence statistics
#         cooccurrence_stats = defaultdict(lambda: defaultdict(int))
#         for word, neighbors in word_contexts.items():
#             for neighbor in neighbors:
#                 if neighbor in word_freq:
#                     cooccurrence_stats[word][neighbor] += 1

#         # Create co-occurrence DataFrame
#         cooccur_table = []
#         for word1 in cooccurrence_stats:
#             for word2 in cooccurrence_stats[word1]:
#                 freq = cooccurrence_stats[word1][word2]
#                 total_occurrences = sum(cooccurrence_stats[word1].values())
#                 percentage = (freq / total_occurrences) * 100 if total_occurrences > 0 else 0
                
#                 cooccur_table.append({
#                     "Word 1": word1,
#                     "Word 2": word2,
#                     "Frequency": freq,
#                     "Percentage": f"{percentage:.1f}%",
#                     "Word1 Freq": word_freq[word1],
#                     "Word2 Freq": word_freq[word2]
#                 })

#         df = pd.DataFrame(cooccur_table)
#         df = df.sort_values("Frequency", ascending=False)

#         # Urdu text preparation
#         def prepare_urdu_text(text, for_display=True):
#             try:
#                 if not text or not isinstance(text, str):
#                     return text
#                 reshaped = arabic_reshaper.reshape(text)
#                 return get_display(reshaped) if for_display else reshaped
#             except Exception as e:
#                 print(f"Text preparation error for '{text}': {str(e)}")
#                 return text

#         # Create options window
#         option_window = tk.Toplevel()
#         option_window.title("Network Options")
#         option_window.geometry("350x250")

#         # Frequency threshold
#         tk.Label(option_window, text="Minimum Frequency:").pack(pady=5)
#         min_freq = tk.IntVar(value=2)
#         tk.Entry(option_window, textvariable=min_freq).pack()

#         # Font size multiplier
#         tk.Label(option_window, text="Font Size Multiplier:").pack(pady=5)
#         font_mult = tk.DoubleVar(value=1.5)
#         tk.Entry(option_window, textvariable=font_mult).pack()

#         # Spacing control
#         tk.Label(option_window, text="Node Spacing:").pack(pady=5)
#         spacing_var = tk.DoubleVar(value=1.0)
#         tk.Scale(option_window, from_=0.5, to=2.0, resolution=0.1, orient=tk.HORIZONTAL, variable=spacing_var).pack()
        
#         def proceed_network():
#             try:
#                 option_window.destroy()
#                 freq_threshold = min_freq.get()
#                 font_factor = font_mult.get()
#                 spacing = spacing_var.get()

#                 # --- Urdu Text Preparation Function ---
#                 def prepare_urdu_text(text, for_display=True):
#                     try:
#                         if not text or not isinstance(text, str):
#                             return text
#                         reshaped = arabic_reshaper.reshape(text)
#                         return get_display(reshaped) if for_display else reshaped
#                     except Exception as e:
#                         print(f"Text preparation error for '{text}': {str(e)}")
#                         return text

#                 # --- Visualization Window ---
#                 viz_window = tk.Toplevel()
#                 viz_window.title("Urdu Word Network Visualization")
#                 viz_window.geometry("1200x900")
                
#                 container = tk.PanedWindow(viz_window, orient=tk.VERTICAL)
#                 container.pack(fill=tk.BOTH, expand=True)
                
#                 # Graph Frame
#                 graph_frame = tk.Frame(container, bg='white')
#                 container.add(graph_frame, height=600)
                
#                 # Table Frame
#                 table_frame = tk.Frame(container)
#                 container.add(table_frame)

#                 # --- Graph Creation ---
#                 fig = plt.Figure(figsize=(12, 8), dpi=100)
#                 ax = fig.add_subplot(111)
#                 ax.set_facecolor('#f5f5f5')
                
#                 # Urdu font configuration
#                 urdu_font_path = os.path.join("D:", "PYTHON", "Python-3.9.19", "arial", "ARIAL.ttf")
#                 font_prop = fm.FontProperties(fname=urdu_font_path) if os.path.exists(urdu_font_path) else fm.FontProperties(family='Arial')

#                 # --- Network Graph ---
#                 G = nx.Graph()
#                 node_data = {}
#                 node_colors = [
#                     '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
#                     '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
#                 ]
#                 random.shuffle(node_colors)
                
#                 # Add nodes
#                 for i, (word, count) in enumerate(word_freq.items()):
#                     if count >= freq_threshold:
#                         shaped_text = prepare_urdu_text(word, True)
#                         original_text = word
#                         G.add_node(shaped_text, size=count, original_word=original_text)
#                         node_data[shaped_text] = {
#                             'original': original_text,
#                             'frequency': count,
#                             'connections': [],  # Initialize empty connections list
#                             'color': node_colors[i % len(node_colors)]
#                         }

#                 # Add edges with colorful styling
#                 edge_colors = []
#                 edge_widths = []

#                 for word1 in cooccurrence_stats:
#                     if word_freq[word1] >= freq_threshold:
#                         shaped1 = prepare_urdu_text(word1, True)
#                         for word2, freq in cooccurrence_stats[word1].items():
#                             if word_freq[word2] >= freq_threshold:
#                                 shaped2 = prepare_urdu_text(word2, True)
                                
#                                 if G.has_node(shaped1) and G.has_node(shaped2):
#                                     # Get the colors of the connected nodes
#                                     color1 = node_data[shaped1]['color']
#                                     color2 = node_data[shaped2]['color']
                                    
#                                     # Create a gradient between the two node colors
#                                     edge_color = '#{:02X}{:02X}{:02X}'.format(
#                                         (int(color1[1:3], 16) + int(color2[1:3], 16)) // 2,
#                                         (int(color1[3:5], 16) + int(color2[3:5], 16)) // 2,
#                                         (int(color1[5:7], 16) + int(color2[5:7], 16)) // 2
#                                     )
                                    
#                                     # Scale width by co-occurrence frequency
#                                     max_freq = max(cooccurrence_stats[word1].values())
#                                     edge_width = 0.5 + 3 * (freq / max_freq)
                                    
#                                     G.add_edge(shaped1, shaped2, weight=freq, color=edge_color, width=edge_width)
                                    
#                                     # Add connection information to both nodes
#                                     node_data[shaped1]['connections'].append((shaped2, freq))
#                                     node_data[shaped2]['connections'].append((shaped1, freq))
                                    
#                                     edge_colors.append(edge_color)
#                                     edge_widths.append(edge_width)
                
#                 if G.number_of_nodes() == 0:
#                     status_bar.config(text="No words meet frequency threshold", fg="red")
#                     viz_window.destroy()
#                     return

#                 # --- Visualization ---
#                 pos = nx.spring_layout(G, k=0.8*spacing, seed=42, iterations=100)
                
#                 # Draw edges
#                 nx.draw_networkx_edges(
#                     G, pos,
#                     edgelist=list(G.edges()),
#                     width=[G[u][v]['width'] for u,v in G.edges()],
#                     edge_color=[G[u][v]['color'] for u,v in G.edges()],
#                     alpha=0.7,
#                     ax=ax
#                 )

#                 # Draw nodes
#                 node_texts = {}
#                 for node, (x, y) in pos.items():
#                     text_obj = ax.text(  # This assignment was missing in your code
#                         x, y,
#                         node,
#                         fontsize=10 + node_data[node]['frequency'] * font_factor * 0.5,
#                         fontweight='bold',
#                         color=node_data[node]['color'],
#                         ha='center',
#                         va='center',
#                         fontproperties=font_prop,
#                         bbox=dict(
#                             facecolor='white',
#                             alpha=0.8,
#                             edgecolor=node_data[node]['color'],
#                             boxstyle='round,pad=0.2',
#                             linewidth=1.5
#                         ),
#                         picker=True
#                     )
#                     node_texts[text_obj] = node  # Now properly storing the text object
#                 # Create table
#                 columns = ["Word 1", "Word 2", "Frequency", "Percentage", "Word1 Freq", "Word2 Freq"]
#                 tree = ttk.Treeview(table_frame, columns=columns, show="headings", height=10)
                
#                 for col in columns:
#                     tree.heading(col, text=col)
#                     tree.column(col, width=120, anchor='center')
                
#                 # Add scrollbars
#                 vscroll = ttk.Scrollbar(table_frame, orient="vertical", command=tree.yview)
#                 hscroll = ttk.Scrollbar(table_frame, orient="horizontal", command=tree.xview)
#                 tree.configure(yscrollcommand=vscroll.set, xscrollcommand=hscroll.set)
                
#                 # Grid layout
#                 tree.grid(row=0, column=0, sticky="nsew")
#                 vscroll.grid(row=0, column=1, sticky="ns")
#                 hscroll.grid(row=1, column=0, sticky="ew")
                
#                 # Configure resizing
#                 table_frame.grid_rowconfigure(0, weight=1)
#                 table_frame.grid_columnconfigure(0, weight=1)

#                 # --- INTERACTIVITY FUNCTIONS ---
                
#                 # Inverse zoom
#                 def on_scroll(event):
#                     ax = event.inaxes
#                     if not ax:
#                         return
                    
#                     # INVERSE ZOOM: scroll up zooms out, scroll down zooms in
#                     scale_factor = 1/1.2 if event.button == 'up' else 1.2
                    
#                     xlim = ax.get_xlim()
#                     ylim = ax.get_ylim()
#                     xdata = event.xdata
#                     ydata = event.ydata
                    
#                     if xdata is None or ydata is None:
#                         return
                    
#                     ax.set_xlim([xdata - (xdata - xlim[0]) * scale_factor,
#                                 xdata + (xlim[1] - xdata) * scale_factor])
#                     ax.set_ylim([ydata - (ydata - ylim[0]) * scale_factor,
#                                 ydata + (ylim[1] - ydata) * scale_factor])
#                     fig.canvas.draw_idle()

#                 # Pan functionality
#                 pan_start = None
#                 def on_press(event):
#                     nonlocal pan_start
#                     if event.inaxes != ax:
#                         return
#                     pan_start = (event.xdata, event.ydata)
                
#                 def on_motion(event):
#                     nonlocal pan_start
#                     if pan_start is None or event.inaxes != ax:
#                         return
                    
#                     dx = event.xdata - pan_start[0]
#                     dy = event.ydata - pan_start[1]
                    
#                     xlim = ax.get_xlim()
#                     ylim = ax.get_ylim()
                    
#                     ax.set_xlim(xlim[0] - dx, xlim[1] - dx)
#                     ax.set_ylim(ylim[0] - dy, ylim[1] - dy)
#                     fig.canvas.draw_idle()
#                     pan_start = (event.xdata, event.ydata)
                
#                 def on_release(event):
#                     nonlocal pan_start
#                     pan_start = None

#                 # Node click handler
#                 def on_pick(event):
#                     nonlocal tree  # This makes the tree variable accessible
            
#                     artist = event.artist
#                     if artist not in node_texts:
#                         return
                        
#                     node = node_texts[artist]
                    
#                     # Highlight clicked node
#                     for text, n in node_texts.items():
#                         text.set_bbox(dict(
#                             facecolor='#ffffcc' if n == node else 'white',
#                             alpha=0.9 if n == node else 0.8,
#                             edgecolor=node_data[n]['color'],
#                             boxstyle='round,pad=0.3' if n == node else 'round,pad=0.2',
#                             linewidth=2 if n == node else 1.5
#                         ))
#                         if n == node:
#                             text.set_fontsize(12 + node_data[n]['frequency'] * font_factor * 0.5)
                    
#                     # Clear existing table data
#                     tree.delete(*tree.get_children())
                    
#                     # Add new connections
#                     connections = node_data[node]['connections']
#                     for conn, freq in connections:
#                         if conn in node_data:  # Safety check
#                             word1 = node_data[node]['original']
#                             word2 = node_data[conn]['original']
#                             total = sum(c[1] for c in connections)
#                             percentage = (freq / total) * 100 if total > 0 else 0
                            
#                             tree.insert("", tk.END, values=(
#                                 prepare_urdu_text(word1),
#                                 prepare_urdu_text(word2),
#                                 freq,
#                                 f"{percentage:.1f}%",
#                                 node_data[node]['frequency'],
#                                 node_data[conn]['frequency']
#                             ))
                    
#                     fig.canvas.draw_idle()

#                 # Connect event handlers
#                 fig.canvas.mpl_connect('scroll_event', on_scroll)
#                 fig.canvas.mpl_connect('button_press_event', on_press)
#                 fig.canvas.mpl_connect('motion_notify_event', on_motion)
#                 fig.canvas.mpl_connect('button_release_event', on_release)
#                 fig.canvas.mpl_connect('pick_event', on_pick)

#                 # Embed graph
#                 canvas = FigureCanvasTkAgg(fig, master=graph_frame)
#                 canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
#                 canvas.draw()

               

#             except Exception as e:
#                 status_bar.config(text=f"Error: {str(e)}", fg="red")
#                 print(f"Error in generate_bibliometric_network: {str(e)}")

            

#         # Generate network button
#         tk.Button(
#             option_window,
#             text="Generate Network",
#             command=proceed_network,
#             bg="#2196F3",
#             fg="white",
#             padx=10,
#             pady=5
#         ).pack(pady=10)

#     except Exception as e:
#         status_bar.config(text=f"Error: {str(e)}", fg="red")
#         messagebox.showerror("Error", f"Failed to generate network:\n{str(e)}")
#         traceback.print_exc()

# # Add this to your UI code where you create buttons:
# button_frame = tk.Frame(root)
# button_frame.pack(pady=10)

# wordcloud_btn = tk.Button(
#     button_frame,
#     text="Generate Word Cloud",
#     command=generate_word_frequency_chart,
#     bg="#2196F3",
#     fg="white",
#     width=20
# )
# wordcloud_btn.pack(side=tk.LEFT, padx=5)

# bibliometric_btn = tk.Button(
#     button_frame,
#     text="Generate Bibliometric Network",
#     command=generate_bibliometric_network,
#     bg="#9C27B0",
#     fg="white",
#     width=20
# )
# bibliometric_btn.pack(side=tk.LEFT, padx=5)



# #grammar tree visualization based on POS (Part-of-Speech)

# def generate_grammar_tree():
#     """Generate a grammar tree visualization from POS tagged data"""
#     try:
#         # Step 1: File selection dialog
#         file_path = filedialog.askopenfilename(
#             title="Select POS Tagged File",
#             filetypes=[("Text files", "*.txt"), ("CSV files", "*.csv"), ("All files", "*.*")]
#         )
#         if not file_path:
#             status_bar.config(text="No file selected", fg="orange")
#             return

#         # Step 2: Read and parse the file
#         def parse_file(filepath):
#             sentences = []
#             current_sentence = []
            
#             with open(filepath, 'r', encoding='utf-8') as f:
#                 for line in f:
#                     line = line.strip()
#                     if not line:  # Empty line indicates sentence end
#                         if current_sentence:
#                             sentences.append(current_sentence)
#                             current_sentence = []
#                         continue
                    
#                     # Parse word/POS pairs (adjust format as needed)
#                     if '\t' in line:  # Tab-separated
#                         word, pos = line.split('\t')[:2]
#                     elif ' ' in line:  # Space-separated
#                         word, pos = line.split(' ')[:2]
#                     else:
#                         continue
                    
#                     current_sentence.append((word.strip(), pos.strip()))
            
#             if current_sentence:  # Add last sentence if file doesn't end with newline
#                 sentences.append(current_sentence)
#             return sentences

#         tagged_sentences = parse_file(file_path)
#         if not tagged_sentences:
#             status_bar.config(text="No valid POS tagged sentences found", fg="red")
#             return

#         # Step 3: Get selected sentence from table if available
#         selected_sentence = []
#         try:
#             selected_items = tree.selection()
#             if selected_items:
#                 selected_values = tree.item(selected_items[0])['values']
#                 if len(selected_values) > 1:
#                     selected_text = str(selected_values[1])
#                     # Find matching sentence in tagged data
#                     for sentence in tagged_sentences:
#                         if selected_text in ' '.join([word for word, pos in sentence]):
#                             selected_sentence = sentence
#                             break
#         except:
#             pass  # Use first sentence if selection fails

#         # Use first sentence if no selection matched
#         if not selected_sentence and tagged_sentences:
#             selected_sentence = tagged_sentences[0]

#         # Step 4: Create grammar tree visualization
#         viz_window = tk.Toplevel()
#         viz_window.title("Grammar Tree Visualization")
#         viz_window.geometry("1000x700")


#         # Create frame for canvas and controls
#         main_frame = tk.Frame(viz_window)
#         main_frame.pack(fill=tk.BOTH, expand=True)

#         # Create matplotlib figure
#         fig = plt.Figure(figsize=(10, 8), dpi=100)
#         ax = fig.add_subplot(111)
#         ax.set_axis_off()
#         ax.set_title("Grammar Tree Structure", pad=20)

#         # Urdu text preparation
#         def prepare_urdu_text(text):
#             if not text or not isinstance(text, str):
#                 return text
#             try:
#                 reshaped = arabic_reshaper.reshape(text)
#                 return get_display(reshaped)
#             except:
#                 return text

#         # Grammar tree drawing function
#         # Modified grammar tree drawing function
#         def draw_tree(sentence, ax):
#             ax.clear()
#             ax.set_axis_off()
            
#             # Create tree structure from POS tags
#             grammar = nltk.CFG.fromstring("""
#                 S -> NP VP
#                 NP -> Det N | N | NP PP
#                 VP -> V NP | VP PP
#                 PP -> P NP
#                 Det -> 'DT'
#                 N -> 'NN' | 'NNS' | 'NNP' | 'NNPS'
#                 V -> 'VB' | 'VBD' | 'VBG' | 'VBN' | 'VBP' | 'VBZ'
#                 P -> 'IN' | 'TO'
#                 Adj -> 'JJ' | 'JJR' | 'JJS'
#                 Adv -> 'RB' | 'RBR' | 'RBS'
#                 """)
            
#             # Convert to (word, POS) tuples that nltk expects
#             pos_tags = [(prepare_urdu_text(word), pos) for word, pos in sentence]
            
#             try:
#                 # Create parse tree
#                 parser = nltk.ChartParser(grammar)
#                 trees = list(parser.parse([pos for (word, pos) in pos_tags]))
                
#                 if trees:
#                     tree = trees[0]
#                 else:
#                     # Fallback to POS tag tree if no grammar parse
#                     tree = nltk.Tree('S', [nltk.Tree(pos, [prepare_urdu_text(word)]) 
#                                          for word, pos in sentence])
                
#                 # Create a new Tkinter canvas for NLTK tree drawing
#                 tree_canvas = tk.Canvas(viz_window, width=800, height=600)
#                 tree_canvas.pack(fill=tk.BOTH, expand=True)
                
#                 # Draw the tree using NLTK's tree drawer
#                 tree_widget = nltk.draw.TreeWidget(tree_canvas, tree)
#                 tree_widget['node_font'] = ('Arabic Typesetting', 12)
#                 tree_widget['leaf_font'] = ('Arabic Typesetting', 12)
#                 tree_widget['node_color'] = '#0066cc'
#                 tree_widget['leaf_color'] = '#0066cc'
#                 tree_widget['line_color'] = '#000000'
                
#                 # Pack the tree widget
#                 tree_widget.pack(expand=1, fill=tk.BOTH)
                
#                 # Hide the matplotlib axes since we're using Tkinter canvas
#                 ax.set_visible(False)
                
#             except Exception as e:
#                 status_bar.config(text=f"Tree parsing error: {str(e)}", fg="orange")
#                 # Simple text display as fallback
#                 ax.text(0.5, 0.5, "Could not generate tree visualization\n" + str(e),
#                        ha='center', va='center', fontsize=12)
        
#         # Create visualization window
#         viz_window = tk.Toplevel()
#         viz_window.title("Grammar Tree Visualization")
#         viz_window.geometry("1000x700")
        
#         # Create frame for tree display
#         tree_frame = tk.Frame(viz_window)
#         tree_frame.pack(fill=tk.BOTH, expand=True)
        
#         # Create matplotlib figure (hidden initially)
#         fig = plt.Figure(figsize=(10, 8), dpi=100)
#         ax = fig.add_subplot(111)
#         ax.set_axis_off()
        
#         # Initial tree drawing
#         draw_tree(selected_sentence, ax)

#         # Canvas for matplotlib figure
#         canvas = FigureCanvasTkAgg(fig, master=main_frame)
#         canvas.draw()
#         canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)

#         # Control panel
#         control_frame = tk.Frame(viz_window)
#         control_frame.pack(fill=tk.X, padx=5, pady=5)

#         # Sentence selection dropdown
#         tk.Label(control_frame, text="Select Sentence:").pack(side=tk.LEFT)
#         sentence_var = tk.StringVar()
#         sentence_dropdown = ttk.Combobox(
#             control_frame, 
#             textvariable=sentence_var,
#             values=[' '.join([w for w,p in s]) for s in tagged_sentences],
#             state="readonly",
#             width=50
#         )
#         sentence_dropdown.pack(side=tk.LEFT, padx=5)
#         sentence_dropdown.set(' '.join([w for w,p in selected_sentence]))

#         # Redraw function
#         def redraw_tree(*args):
#             selected_text = sentence_var.get()
#             for sentence in tagged_sentences:
#                 if selected_text == ' '.join([w for w,p in sentence]):
#                     draw_tree(sentence, ax)
#                     canvas.draw()
#                     break

#         sentence_var.trace_add('write', redraw_tree)

#         # Save button
#         def save_tree():
#             file_path = filedialog.asksaveasfilename(
#                 defaultextension=".png",
#                 filetypes=[("PNG files", "*.png"), ("PDF files", "*.pdf"), ("All files", "*.*")]
#             )
#             if file_path:
#                 fig.savefig(file_path, dpi=300, bbox_inches='tight')
#                 status_bar.config(text=f"Tree saved to {file_path}", fg="green")

#         tk.Button(
#             control_frame,
#             text="Save Tree",
#             command=save_tree,
#             bg="#4CAF50",
#             fg="white"
#         ).pack(side=tk.RIGHT, padx=5)

#         status_bar.config(text="Grammar tree generated", fg="green")

#     except Exception as e:
#         status_bar.config(text=f"Error: {str(e)}", fg="red")
#         messagebox.showerror("Error", f"Failed to generate grammar tree:\n{str(e)}")
         
#         traceback.print_exc()

# # Add to your UI buttons:
# grammar_btn = tk.Button(
#     button_frame,
#     text="Generate Grammar Tree",
#     command=generate_grammar_tree,
#     bg="#FF9800",  # Orange color
#     fg="white",
#     width=20
# )
# grammar_btn.pack(side=tk.LEFT, padx=5)

# Run the application
root.mainloop()
