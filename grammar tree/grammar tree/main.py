import tkinter as tk
from tkinter import messagebox, scrolledtext, filedialog
from nltk.tree import Tree
from nltk.draw.util import CanvasFrame
from nltk.draw import TreeWidget
import threading
import stanza
import os
from PIL import Image

# Urdu POS Tag Lists
aux_verbs = ["ہے", "ہیں", "تھا", "تھی", "تھے", "رہا", "رہی", "رہے", "چکا", "چکی", "چکے", "گیا", "گئی", "گئے", "ہو", "ہوں", "ہوگا", "ہوگی", "ہونگے"]
postpositions = ["میں", "پر", "سے", "کو", "کا", "کے", "کی", "تک", "لئے", "لیے", "بذریعہ", "ساتھ", "بعد", "پہ", "تحت", "مقابل", "جیسا", "واسطے"]
conjunctions = ["اور", "لیکن", "بلکہ", "تاہم", "یا", "اگر", "جب", "کہ", "حالانکہ", "چونکہ", "کیونکہ", "تو", "تاکہ"]
pronouns = ["میں", "ہم", "آپ", "تم", "وہ", "یہ", "تو", "ان", "انہیں", "اس", "اسے", "تمہیں", "جن", "جو", "کون", "کیا", "کس"]
determiners = ["ایک", "کچھ", "ہر", "یہ", "وہ", "میرا", "تیرا", "اس", "ان", "کئی", "تمام", "زیادہ", "کم"]
adjectives = ["اچھا", "برا", "خوبصورت", "لمبا", "چھوٹا", "تیز", "سست", "نیا", "پرانا", "ذہین", "محنتی"]
adverbs = ["فوراً", "آہستہ", "جلدی", "کبھی", "ہمیشہ", "اب", "پھر", "ابھی", "بار بار", "اکثر", "کل", "روز", "یقیناً"]
nouns = ["لڑکا", "لڑکی", "کتاب", "استاد", "طالبعلم", "درخت", "گھر", "پانی", "دوست", "پہاڑ", "سفر", "وقت", "شخص"]
verbs = ["کیا", "کرتا", "کرتی", "کرتے", "جاتا", "جاتی", "گیا", "چلا", "پڑا", "دیا", "لیا", "کھایا", "سویا", "لکھا", "پڑھا", "بولا"]
nums = ["۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹", "۱۰", "١١", "١٢", "١٣", "١٤", "ایک", "دو", "تین", "چار", "پانچ", "چھ", "سات", "آٹھ", "نو", "دس", "سو", "ہزار", "لاکھ", "کروڑ"]

# Color Map for POS
tag_color_map = {
    "AUX": "orange", "ADP": "skyblue", "CCONJ": "violet", "PRON": "green",
    "DET": "lightgreen", "ADJ": "plum", "ADV": "yellow", "NOUN": "lightblue",
    "VERB": "red", "INTJ": "pink", "SCONJ": "purple", "NUM": "cyan",
    "PART": "gray", "PROPN": "gold", "PUNCT": "white", "SYM": "black", "X": "lightgray"
}

# Download Urdu model if needed
stanza.download('ur')
nlp = stanza.Pipeline('ur')

# Apply Urdu-specific POS refinements
def apply_custom_pos_rules(word):
    tag = word.upos
    if word.text in aux_verbs:
        tag = "AUX"
    elif word.text in postpositions:
        tag = "ADP"
    elif word.text in conjunctions:
        tag = "CCONJ"
    elif word.text in pronouns:
        tag = "PRON"
    elif word.text in determiners:
        tag = "DET"
    elif word.text.endswith("نے") and word.upos == "NOUN":
        tag = "PRON"
    return tag

# Convert Stanza dependency tree to NLTK Tree
def to_nltk_tree(word, deps):
    tag = apply_custom_pos_rules(word)
    label = f"({tag})\n{word.text}"
    if word.id in deps:
        return Tree(label, [to_nltk_tree(child, deps) for child in deps[word.id]])
    return Tree(label, [])

# Custom TreeWidget with colored nodes
class ColoredTreeWidget(TreeWidget):
    def __init__(self, canvas, tree):
        super().__init__(canvas, tree)
        self._node_height = 60
        self.color_nodes()

    def color_nodes(self):
        for node_widget in self._nodes:
            try:
                label = node_widget.label()
                if "\n" in label:
                    pos, _ = label.split("\n", 1)
                    pos = pos.strip("()")
                    color = tag_color_map.get(pos, "black")
                    cx, cy = node_widget._coords
                    r = 20
                    self.canvas().create_oval(cx - r, cy - r - 25, cx + r, cy + r - 25, outline=color, width=2)
            except:
                continue

cf = None  # Global CanvasFrame

def draw_all_trees(trees):
    global cf
    cf = CanvasFrame()
    x, y = 10, 10
    max_width = 0

    for t in trees:
        tw = ColoredTreeWidget(cf.canvas(), t)
        cf.add_widget(tw, x, y)
        y += 220
        max_width = max(max_width, tw.bbox()[2])

    # Draw POS color legend
    legend_x = max_width + 40
    y_pos = 20
    cf.canvas().create_text(legend_x, y_pos - 20, text="POS Color Legend", font=("Arial", 10, "bold"), anchor="nw")
    for tag, color in tag_color_map.items():
        cf.canvas().create_rectangle(legend_x, y_pos, legend_x + 15, y_pos + 12, fill=color, outline="")
        cf.canvas().create_text(legend_x + 20, y_pos, text=tag, font=("Arial", 9), anchor="nw")
        y_pos += 15

    # Zoom handlers
    def zoom(event):
        factor = 1.1 if event.delta > 0 or event.num == 4 else 0.9
        cf.canvas().scale("all", event.x, event.y, factor, factor)

    # Bind mouse wheel and Linux scroll
    cf.canvas().bind("<MouseWheel>", zoom)        # Windows/macOS
    cf.canvas().bind("<Button-4>", zoom)          # Linux scroll up
    cf.canvas().bind("<Button-5>", zoom)          # Linux scroll down

    # Add Save Button
    save_button = tk.Button(cf.canvas().master, text="💾 Save Tree as Image", font=("Arial", 12), command=save_tree_as_image)
    save_button.pack(side=tk.BOTTOM, pady=10)

    cf.canvas().mainloop()


def parse_text():
    txt = text_input.get("1.0", tk.END).strip()
    if not txt:
        messagebox.showwarning("⚠️ Input Required", "Please enter some Urdu text.")
        return
    try:
        doc = nlp(txt)
        trees = []
        for sentence in doc.sentences:
            deps = {}
            for word in sentence.words:
                deps.setdefault(word.head, []).append(word)
            root = next((w for w in sentence.words if w.head == 0), None)
            if root:
                trees.append(to_nltk_tree(root, deps))
        if trees:
            threading.Thread(target=draw_all_trees, args=(trees,)).start()
    except Exception as e:
        messagebox.showerror("Error", str(e))

def save_tree_as_image():
    global cf
    if cf:
        file_path = filedialog.asksaveasfilename(defaultextension=".png", filetypes=[("PNG Image", "*.png")])
        if not file_path:
            return
        temp_ps = "temp_tree_output.ps"
        cf.canvas().postscript(file=temp_ps, colormode='color')
        image = Image.open(temp_ps)
        image.save(file_path, "PNG")
        os.remove(temp_ps)
        messagebox.showinfo("Saved", f"Saved tree image:\n{file_path}")
    else:
        messagebox.showwarning("No Tree", "Please generate a tree first.")

# GUI Setup
window = tk.Tk()
window.title("🌳 Urdu Grammar Tree Viewer")
window.geometry("800x600")

tk.Label(window, text="Enter Urdu Text:", font=("Arial", 14)).pack(pady=10)
text_input = scrolledtext.ScrolledText(window, width=70, height=10, font=("Arial", 16), wrap=tk.WORD)
text_input.pack(padx=20)

tk.Button(window, text="🌲 Generate Grammar Tree", font=("Arial", 14), command=parse_text).pack(pady=10)
# Removed Save Tree as Image button
# tk.Button(window, text="💾 Save Tree as Image", font=("Arial", 14), command=save_tree_as_image).pack(pady=10)

window.mainloop()

