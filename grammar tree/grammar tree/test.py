# ✅ Importing modules
import tkinter as tk
from tkinter import messagebox, scrolledtext, filedialog
from nltk.tree import Tree
from nltk.draw.util import CanvasFrame
from nltk.draw import TreeWidget
import threading
import stanza
import os
from PIL import Image, ImageTk
import re

# ✅ Urdu POS Tag Word Lists (Use your own detailed lists here)
aux_verbs = ['ہے', 'ہوں', 'تھا', 'تھی', 'ہیں']
postpositions = ['میں', 'پر', 'سے', 'کو']
conjunctions = ['اور', 'لیکن']
pronouns = ['میں', 'تو', 'وہ', 'ہم']
determiners = ['یہ', 'وہ']
adjectives = ['اچھا', 'برا']
adverbs = ['تیزی', 'آہستہ']
nouns = ['لڑکا', 'کتاب']
verbs = ['کرتا', 'کیا']

# ✅ POS Color Map
tag_color_map = {
    "AUX": "orange", "ADP": "skyblue", "CCONJ": "violet", "PRON": "green",
    "DET": "lightgreen", "ADJ": "plum", "ADV": "yellow", "NOUN": "lightblue",
    "VERB": "red", "INTJ": "pink", "SCONJ": "purple", "NUM": "cyan",
    "PART": "gray", "PROPN": "gold", "PUNCT": "white", "SYM": "black", "X": "lightgray", "ROOT": "crimson"
}

# ✅ NLP Initialization
stanza.download('ur')
nlp = stanza.Pipeline('ur')

# ✅ POS Rules
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

def to_nltk_tree(word, deps, root_id=None):
    tag = apply_custom_pos_rules(word)
    label = f"({tag})\n{word.text}"
    if word.id == root_id:
        label = f"(ROOT)\n{word.text}"
    if word.id in deps:
        return Tree(label, [to_nltk_tree(child, deps, root_id) for child in deps[word.id]])
    return Tree(label, [])

# ✅ Custom TreeWidget with colored circular nodes
class ColoredTreeWidget(TreeWidget):
    def __init__(self, canvas, tree):
        super().__init__(canvas, tree)
        self._node_font = ('Arial', 10, 'bold')
        self._leaf_font = ('Arial', 9, 'bold')
        self._hspace = 30
        self._vspace = 80
        self._line_color = 'black'

    def _draw_node(self, node, x, y):
        label = node.label()
        pos, word = label.split("\n", 1) if "\n" in label else ("NOUN", label)
        pos = pos.strip("()")
        color = tag_color_map.get(pos, "white")
        radius = max(25, min(50, len(word) * 5))

        # Draw colored circle
        self.canvas().create_oval(x - radius, y - radius, x + radius, y + radius,
                                  outline="black", width=2, fill=color)

        # Word inside the node
        self.canvas().create_text(x, y, text=word, font=self._node_font, fill='black')

        # POS tag below the node
        self.canvas().create_text(x, y + radius + 12, text=pos, font=('Arial', 9, 'italic'), fill='black')

        return (x - radius, y - radius, x + radius, y + radius + 20)

    def _tree(self):
        self.__draw_tree(self._tree, self._x, self._y)

    def __draw_tree(self, tree, x, y):
        (x1, y1, x2, y2) = self._draw_node(tree, x, y)
        if not tree:
            return (x1, y1, x2, y2)

        child_x = x - (len(tree) * self._hspace) / 2 + self._hspace / 2
        child_y = y + self._vspace

        for child in tree:
            (cx1, cy1, cx2, cy2) = self.__draw_tree(child, child_x, child_y)
            self.canvas().create_line(x, y2, child_x, cy1, fill=self._line_color)
            child_x += self._hspace
        return (x1, y1, child_x - self._hspace, child_y + (y2 - y1))

# ✅ Tree Drawer
def draw_all_trees(trees):
    global cf
    cf = CanvasFrame(width=1200, height=800)
    x, y = 100, 50
    max_right = max_bottom = 0

    for t in trees:
        tw = ColoredTreeWidget(cf.canvas(), t)
        cf.add_widget(tw, x, y)
        bbox = tw.bbox()
        max_right = max(max_right, bbox[2] + x)
        max_bottom = max(max_bottom, bbox[3] + y)
        y += bbox[3] + 80

    # POS Legend
    legend_x = max_right + 50
    legend_y = 50
    cf.canvas().create_text(legend_x, legend_y-20, text="POS Color Legend", font=("Arial", 10, "bold"))
    for i, (tag, color) in enumerate(tag_color_map.items()):
        cf.canvas().create_rectangle(legend_x, legend_y + i*20, legend_x + 15, legend_y + i*20 + 15, fill=color, outline='black')
        cf.canvas().create_text(legend_x + 25, legend_y + i*20 + 8, text=tag, anchor='w', font=("Arial", 9))

    # Zooming
    def zoom(event):
        factor = 1.1 if event.delta > 0 else 0.9
        cf.canvas().scale("all", event.x, event.y, factor, factor)

    cf.canvas().bind("<MouseWheel>", zoom)

    # Save Button
    save_btn = tk.Button(cf.canvas().master, text="💾 Save Tree Image", command=save_tree_as_image)
    save_btn.pack(side=tk.BOTTOM, pady=10)

    cf.canvas().config(scrollregion=(0, 0, max_right + 200, max_bottom + 100))
    cf.canvas().mainloop()

# ✅ NLP Parser
def parse_text():
    txt = text_input.get("1.0", tk.END).strip()
    if not txt:
        messagebox.showwarning("⚠️ Input Required", "Please enter some Urdu text.")
        return
    if not re.search(r'[\u0600-\u06FF]', txt):
        messagebox.showwarning("⚠️ Urdu Required", "Please enter text in Urdu.")
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
                trees.append(to_nltk_tree(root, deps, root_id=root.id))
        if trees:
            threading.Thread(target=draw_all_trees, args=(trees,)).start()
    except Exception as e:
        messagebox.showerror("Error", str(e))

# ✅ Save Image
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

# ✅ GUI Setup
window = tk.Tk()
window.title("🌳 Urdu Grammar Tree Viewer - Enhanced")
window.geometry("900x620")
tk.Label(window, text="Enter Urdu Text:", font=("Arial", 14)).pack(pady=10)
text_input = scrolledtext.ScrolledText(window, width=70, height=10, font=("Arial", 16), wrap=tk.WORD)
text_input.pack(padx=20)
tk.Button(window, text="🌲 Generate Grammar Tree", font=("Arial", 14), command=parse_text).pack(pady=10)
window.mainloop()
