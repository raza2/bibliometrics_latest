# Standard Library
import re
from collections import Counter, defaultdict
import unicodedata

# NLP
import nltk
import stanza
from nltk.tokenize import word_tokenize

# Download NLTK data
nltk.download('punkt', quiet=True)

# Load Stanza Urdu NLP Pipeline
try:
    nlp = stanza.Pipeline(lang='ur', processors='tokenize,pos', use_gpu=True)
except Exception as e:
    print(f"GPU not available, falling back to CPU: {e}")
    nlp = stanza.Pipeline(lang='ur', processors='tokenize,pos', use_gpu=False)


def tokenize(text):
    """Simple tokenization using regex"""
    return re.findall(r'\w+', text)


def normalize_urdu(text):
    """Normalize Urdu text by handling Unicode variations"""
    text = unicodedata.normalize('NFC', text)
    
    replacements = {
        'ٰ': '',   # Remove Arabic superscript alef
        'ھ': 'ہ',  # Unified h
        'ے': 'ی',  # Unified ye
        'ك': 'ک',  # Arabic kaf to Persian kaf
        'ى': 'ی',  # Arabic yeh to Persian yeh
        'ة': 'ہ',  # Arabic teh marbuta to heh
        '\u200c': ' ',  # Zero-width non-joiner to space
        '\u200d': '',   # Remove zero-width joiner
        ''': "'", ''': "'", '"': '"', '"': '"'  # Standardize quotes
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
        "جانا", "دینا", "لینا", "کرنا", "چلنا", "آنا"}
}


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


def classify_pos(word, pos):
    """
    Enhanced POS classifier using consolidated POS_CATEGORIES
    """
    if pos == "NOUN":
        for category in ["proper_nouns", "common_nouns", "abstract_nouns",
                       "verbal_nouns", "collective_nouns"]:
            if word in POS_CATEGORIES[category]:
                return category.replace("_", " ").title()
        return "Noun"
    
    elif pos == "VERB":
        if word in POS_CATEGORIES["helping_verbs"]:
            return "Helping Verb"
        elif word.endswith(('نا', 'نی', 'نے')):
            return "Infinitive Verb"
        elif word.endswith(('تا', 'تی', 'تے')):
            return "Present Verb"
        else:
            return "Main Verb"
    
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
    
    return pos_mapping.get(pos, pos)


def classify_noun(word, doc=None):
    """Enhanced noun classifier with better rules and fallbacks"""
    if doc:
        for sentence in doc.sentences:
            for w in sentence.words:
                if w.text == word and w.upos == "PROPN":
                    return "Proper Nouns"
    
    lower_word = word.lower()
    for category, words in urdu_noun_dict.items():
        if any(lower_word == w.lower() for w in words):
            return category
    
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
        return "Common Nouns"
    elif word.endswith(("ا", "ہ", "و", "ے", "ار")):
        return "Common Nouns"
    
    material_keywords = ("دھات", "معدن", "پتھر", "ریت", "تانبا")
    if any(kw in word for kw in material_keywords):
        return "Material Nouns"
    
    return "Concrete Nouns"


def classify_pronoun(word):
    """Classify pronouns into subcategories"""
    word = word.strip()
    word = re.sub(r'\s+', ' ', word)

    personal_pronouns = {"میں", "ہم", "تم", "وہ", "آپ", "تو"}
    possessive_pronouns = {"میرا", "ہمارا", "تمہارا", "ان کا", "اس کا", "تیرا", "اس"}
    demonstrative_pronouns = {"یہ", "وہ", "یہ لوگ", "وہ لوگ", "یہاں", "وہاں", "اس"}
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


def classify_adjective(word):
    """Classify adjectives into subcategories"""
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
        "بہت", "سارا", "تمام", "ہر", "کوئی", "کسی", "ہر ایک", "آدھا", "ایک چوتھائی", "بہت زیادہ"
    }
    demonstrative_adjectives = {
        "یہ", "وہ", "یہاں", "وہاں", "اس", "ان", "اسے", "انہیں", "یہی", "وہی",
        "اِدھر", "اُدھر", "اِسی", "اُسی", "یہاں کا", "وہاں کا", "یہ سب", "وہ سب"
    }
    interrogative_adjectives = {
        "کونسا", "کونسی", "کونسے", "کیا", "کیسا", "کیسی", "کیسے", "کتنا", "کتنی", "کتنے",
        "کس قسم کا", "کس طرح", "کون", "کیوں", "کہاں"
    }
    possessive_adjectives = {
        "میرا", "تمہارا", "ہمارا", "اس کا", "ان کا", "تیرا", "آپ کا", "ان سب کا", "اس کی", "ان کی",
        "میری", "تیری", "ہماری", "تمہاری", "اس کے", "ان کے"
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


def classify_verb(word):
    """Classify verbs into subcategories"""
    word = word.strip()
    word = re.sub(r'\s+', ' ', word)

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
        return "Main Verb"


def classify_adverb(word):
    """Classify adverbs into subcategories"""
    word = word.strip()
    word = re.sub(r'[\s\u200c]+', ' ', word)

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
        return "Adverb"


def classify_preposition(word):
    """Classify prepositions into subcategories"""
    word = word.strip()
    word = re.sub(r'[\s\u200c]+', ' ', word)

    time_prepositions = {"تک", "پہلے", "بعد", "کے دوران", "کے بعد", "کے پہلے", "کے وقت", "کے لیے", "کے اندر", "کے باہر"}
    place_prepositions = {"پر", "میں", "کے نیچے", "کے اوپر", "کے پاس", "کے قریب", "کے سامنے", "کے پیچھے", "کے اندر", "کے باہر", "کے درمیان", "کے آس پاس"}
    direction_prepositions = {"کی طرف", "کی جانب", "کے رخ", "کے لیے", "سے", "تک", "کے اوپر", "کے نیچے", "کے اندر", "کے باہر"}

    categories = set()
    if word in time_prepositions:
        categories.add("Time Preposition")
    if word in place_prepositions:
        categories.add("Place Preposition")
    if word in direction_prepositions:
        categories.add("Direction Preposition")

    return ", ".join(categories) if categories else "Preposition"


def classify_conjunction(word):
    """Classify conjunctions into subcategories"""
    word = word.strip()
    word = re.sub(r'[\s\u200c]+', ' ', word)

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

    if word in coordinating_conj:
        return "Coordinating Conjunction"
    elif word in subordinating_conj:
        return "Subordinating Conjunction"
    elif any(conj in word for conj in correlative_conj):
        return "Correlative Conjunction"
    else:
        return "Other Conjunction"


def process_text(text):
    """
    Process text and return POS tagging results with context
    Returns: list of tuples (before_words, word, after_words, pos_tag, pos_type, frequency, percentage)
    """
    try:
        doc = nlp(text)
        words = [(word.text, word.upos) for sentence in doc.sentences for word in sentence.words]
        word_counts = Counter(word for word, _ in words)
        
        results = []
        for i, (word, pos) in enumerate(words):
            context_before = " ".join(w[0] for w in words[max(0,i-3):i]) or "-"
            context_after = " ".join(w[0] for w in words[i+1:i+4]) or "-"
            pos_type = classify_pos(word, pos)
            
            results.append({
                "before": context_before,
                "word": word,
                "after": context_after,
                "pos": pos,
                "pos_type": pos_type,
                "frequency": word_counts[word],
                "percentage": f"{(word_counts[word]/len(words))*100:.2f}%"
            })
        
        return results
        
    except Exception as e:
        raise Exception(f"Processing error: {str(e)}")


def filter_by_pos(results, pos_tag):
    """Filter results by POS tag"""
    return [r for r in results if r['pos'] == pos_tag]


def filter_by_subcategory(results, subcategory):
    """Filter results by POS subcategory"""
    return [r for r in results if r['pos_type'] == subcategory]