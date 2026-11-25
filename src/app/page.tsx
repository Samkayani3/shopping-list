
"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

type Status = "pending" | "purchased" | "unavailable" | "skipped";

type ProductCategory = string;

type Item = {
  id: string;
  name: string;
  quantity: number;
  store: string;
  status: Status;
  category?: ProductCategory;
  image?: string;
};

const defaultCategories: ProductCategory[] = ["Smoking sundries", "Vapes", "Drinks", "Groceries", "Fruit & vegetables", "Toiletries", "Toilet paper & tissues", "Kitchen", "Household", "Confectionery & sweets", "Cleaning", "Toys", "Pet food", "Health & pharmacy", "Clothing", "Electronics", "Stationery & office", "DIY & hardware", "Other"];

function detectCategory(productName: string, categories: ProductCategory[] = defaultCategories): ProductCategory {
  const name = productName.toLowerCase();
  const rules: Array<[ProductCategory, RegExp]> = [
    ["Smoking sundries", /\b(lighter|matches|rolling paper|cigarette paper|filters|tobacco pouch)\b/],
    ["Vapes", /\b(vape|vaping|e-liquid|eliquid|vape pod|coil)\b/],
    ["Drinks", /\b(water|juice|cola|lemonade|soda|soft drink|energy drink|coffee|tea|drink|milkshake)\b/],
    ["Toilet paper & tissues", /\b(toilet roll|toilet paper| loo roll|kitchen roll|tissue|tissues)\b/],
    ["Toiletries", /\b(shampoo|conditioner|toothpaste|toothbrush|soap|deodorant|razor|shaving|body wash|moisturi[sz]er|sanitary|nappy|diaper)\b/],
    ["Cleaning", /\b(washing.?up|dish soap|detergent|fabric softener|bleach|disinfectant|cleaner|sponge|bin bag|rubbish bag|laundry|washing powder)\b/],
    ["Kitchen", /\b(pan|saucepan|frying pan|plate|bowl|mug|cup|cutlery|knife|fork|spoon|kettle|toaster|utensil|chopping board)\b/],
    ["Household", /\b(storage|batter(y|ies)|light bulb|bedding|towel|curtain|bin|hanger|furniture)\b/],
    ["Confectionery & sweets", /\b(chocolate|sweets|candy|gummies|toffee|fudge|marshmallow|chewing gum|lollipop)\b/],
    ["Toys", /\b(toy|doll|lego|puzzle|action figure|board game|teddy|soft toy)\b/],
    ["Pet food", /\b(dog food|cat food|pet food|puppy food|kitten food|bird seed|fish food|dog treats|cat treats)\b/],
    ["Fruit & vegetables", /\b(apple|banana|orange|grape|strawberr|potato|tomato|onion|carrot|lettuce|cucumber|broccoli|pepper|fruit|vegetable|salad)\b/],
    ["Health & pharmacy", /\b(paracetamol|ibuprofen|plaster|bandage|medicine|vitamin|prescription|first aid)\b/],
    ["Clothing", /\b(shirt|t.?shirt|trouser|pants|jeans|sock|shoe|coat|jacket|dress|underwear|jumper)\b/],
    ["Electronics", /\b(phone|charger|cable|headphone|earphone|laptop|mouse|keyboard|monitor|adapter|usb)\b/],
    ["Stationery & office", /\b(notebook|pen|pencil|paper|printer|ink|folder|stapler|envelope|marker|highlighter|sticky notes)\b/],
    ["DIY & hardware", /\b(screwdriver|screw|nail|hammer|drill|spanner|wrench|pliers|tape measure|tool|paint|brush|glue|ratchet)\b/],
    ["Groceries", /\b(milk|bread|egg|cheese|butter|rice|pasta|cereal|sugar|flour|oil|sauce|meat|chicken|fish|yogurt|yoghurt|biscuit|snack|frozen)\b/],
  ];
  const detected = rules.find(([category, pattern]) => pattern.test(name) && categories.includes(category))?.[0];
  return detected || (categories.includes("Other") ? "Other" : categories[0] || "Other");
}

type ShoppingList = {
  id: string;
  name: string;
  date: string;
  items: Item[];
};

const initialStores = ["Tesco", "Asda", "Lidl", "Sainsbury's"];

const uid = () => Math.random().toString(36).slice(2, 10);

const spokenNumber = (value: string) => {
  const normalised = value.toLowerCase().trim();
  const words: Record<string, number> = {
    one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, dozen: 12,
  };
  if (/^\d+$/.test(normalised)) return Number(normalised);
  return words[normalised] || null;
};

function parseSpokenProduct(transcript: string) {
  let name = transcript.trim().replace(/[.!?,]+$/g, "");
  let quantity = 1;
  const numberPattern = "\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|dozen";
  const toNumber = (value: string) => spokenNumber(value) ?? (value.toLowerCase() === "dozen" ? 12 : null);

  // Only extract the number of packs when the wording clearly says how many
  // packs the shopper wants. Keep pack descriptions in the product name so
  // we do not confuse pack size with the quantity to buy.
  const packCount = name.match(new RegExp(`^(?:i need |add |get |buy )?(${numberPattern})\\s+packs?\\s+of\\s+(.+)$`, "i"));
  if (packCount) {
    quantity = Math.max(1, toNumber(packCount[1]) || 1);
    name = packCount[2].trim();
  } else if (!/\\b\\d+\\s*[- ]?pack\\b/i.test(name) && !/\\bpack\\s+of\\b/i.test(name)) {
    const leading = name.match(new RegExp(`^(?:i need |add |get |buy )?(${numberPattern})\\s+(?:of\\s+)?(.+)$`, "i"));
    const trailing = name.match(/^(.+?)\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\\s*(?:times|items|pieces|units))?$/i);
    if (leading) {
      const amount = toNumber(leading[1]);
      if (amount) { quantity = amount; name = leading[2].trim(); }
    } else if (trailing) {
      const amount = toNumber(trailing[2]);
      if (amount) { quantity = amount; name = trailing[1].trim(); }
    }
  }
  return { name, quantity };
}

export default function Home() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [stores, setStores] = useState<string[]>(initialStores);
  const [categories, setCategories] = useState<ProductCategory[]>(defaultCategories);
  const [activeId, setActiveId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showListLibrary, setShowListLibrary] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [newListName, setNewListName] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("auto");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newStore, setNewStore] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [showNewStore, setShowNewStore] = useState(false);
  const [message, setMessage] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoItems, setPhotoItems] = useState<Array<{ id: string; name: string; quantity: number; selected: boolean }>>([]);
  const [showPhotoReview, setShowPhotoReview] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);

  useEffect(() => {
    try {
      const savedLists = localStorage.getItem("shopping-lists");
      const savedStores = localStorage.getItem("shopping-stores");
      const savedCategories = localStorage.getItem("shopping-categories");

      if (savedLists) {
        const parsed = JSON.parse(savedLists);
        setLists(parsed);
        if (parsed.length) setActiveId(parsed[0].id);
      }

      if (savedStores) setStores(JSON.parse(savedStores));
      if (savedCategories) setCategories(Array.from(new Set([...defaultCategories, ...JSON.parse(savedCategories)])));
    } catch {
      console.warn("Could not load saved shopping data.");
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("shopping-lists", JSON.stringify(lists));
    localStorage.setItem("shopping-stores", JSON.stringify(stores));
    localStorage.setItem("shopping-categories", JSON.stringify(categories));
  }, [lists, stores, categories, loaded]);

  const activeList = lists.find((list) => list.id === activeId);

  const allItems = lists.flatMap((list) => list.items);
  const totalItems = allItems.length;
  const purchasedItems = allItems.filter(
    (item) => item.status === "purchased"
  ).length;

  const progress =
    totalItems === 0 ? 0 : Math.round((purchasedItems / totalItems) * 100);

  const visibleItems = useMemo(() => {
    if (!activeList) return [];

    return activeList.items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [activeList, search, filter]);

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  }

  function createList() {
    const name = newListName.trim();
    if (!name) return;

    const list: ShoppingList = {
      id: uid(),
      name,
      date: "",
      items: [],
    };

    setLists((previous) => [list, ...previous]);
    setActiveId(list.id);
    setNewListName("");
    setShowNewList(false);
    setSearch("");
    setFilter("all");
    notify("Your shopping list has been created.");
  }

  function updateActive(
    updater: (list: ShoppingList) => ShoppingList
  ) {
    setLists((previous) =>
      previous.map((list) =>
        list.id === activeId ? updater(list) : list
      )
    );
  }

  function addItem() {
    const name = itemName.trim();
    if (!name || !activeList) return;

    const item: Item = {
      id: uid(),
      name,
      quantity: Math.max(1, quantity),
      store: "",
      status: "pending",
      category: selectedCategory === "auto" ? detectCategory(name, categories) : selectedCategory,
    };

    // Stop any active speech session before clearing the form so a late
    // recognition result cannot put the previous words back into the input.
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setVoiceListening(false);
    }

    updateActive((list) => ({
      ...list,
      items: [...list.items, item],
    }));

    setItemName("");
    setQuantity(1);
    notify("Product added. The product and quantity fields are ready for the next item.");
  }

  function updateItem(id: string, changes: Partial<Item>) {
    updateActive((list) => ({
      ...list,
      items: list.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      ),
    }));
  }

  function deleteItem(id: string) {
    updateActive((list) => ({
      ...list,
      items: list.items.filter((item) => item.id !== id),
    }));
  }

  function moveItem(draggedId: string, targetId: string) {
    if (!activeList || draggedId === targetId) return;
    updateActive((list) => {
      const items = [...list.items];
      const from = items.findIndex((item) => item.id === draggedId);
      if (from < 0) return list;
      const [moved] = items.splice(from, 1);
      const target = items.find((item) => item.id === targetId);
      if (!target) return list;
      moved.category = target.category || detectCategory(target.name, categories);
      moved.store = target.store;
      const destination = items.findIndex((item) => item.id === targetId);
      items.splice(destination, 0, moved);
      return { ...list, items };
    });
  }

  function moveItemBy(id: string, direction: -1 | 1) {
    updateActive((list) => {
      const items = [...list.items];
      const index = items.findIndex((item) => item.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= items.length) return list;
      [items[index], items[next]] = [items[next], items[index]];
      const moved = items[next];
      const destination = items[index];
      moved.category = destination.category || detectCategory(destination.name, categories);
      moved.store = destination.store;
      return { ...list, items };
    });
  }

  function deleteList(id: string) {
    if (!window.confirm("Delete this shopping list?")) return;

    const remaining = lists.filter((list) => list.id !== id);
    setLists(remaining);
    setActiveId(remaining[0]?.id || "");
    notify("Shopping list deleted.");
  }

  function renameList() {
    if (!activeList) return;
    const name = window.prompt("Enter a new list name:", activeList.name);
    if (!name?.trim()) return;

    updateActive((list) => ({ ...list, name: name.trim() }));
  }

  function addStore() {
    const name = newStore.trim();
    if (!name) return;

    const existing = stores.find(
      (store) => store.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      setSelectedStore(existing);
      setShowNewStore(false);
      setNewStore("");
      return;
    }

    setStores((previous) => [...previous, name]);
    setSelectedStore(name);
    setNewStore("");
    setShowNewStore(false);
    notify("New store added.");
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    const existing = categories.find((category) => category.toLowerCase() === name.toLowerCase());
    if (existing) setSelectedCategory(existing);
    else {
      setCategories((previous) => [...previous, name]);
      setSelectedCategory(name);
      notify("New category added.");
    }
    setNewCategory("");
    setShowNewCategory(false);
  }

  function saveSchedule() {
    if (!activeList) return;

    updateActive((list) => ({
      ...list,
      date: scheduleDate
        ? `${scheduleDate}${scheduleTime ? " at " + scheduleTime : ""}`
        : "",
    }));

    setShowSchedule(false);
    notify("Shopping schedule saved.");
  }

  function shareList() {
    if (!activeList) return;

    const text = [
      activeList.name,
      activeList.date ? `Shopping date: ${activeList.date}` : "",
      "",
      ...activeList.items.map(
        (item) =>
          `${item.status === "purchased" ? "✓" : "○"} ${item.name} × ${item.quantity}${item.store ? " — " + item.store : ""}`
      ),
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      navigator.share({ title: activeList.name, text }).catch(() => {});
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => notify("Shopping list copied."))
        .catch(() => notify("Unable to copy. Please try again."));
    }
  }

  function copyList() {
    if (!activeList) return;

    const text = [
      activeList.name,
      ...activeList.items.map(
        (item) =>
          `${item.name} × ${item.quantity} — ${item.store || "No store"}`
      ),
    ].join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => notify("Shopping list copied to clipboard."))
      .catch(() => notify("Unable to copy."));
  }

  function printList() {
    window.print();
  }

  function startVoiceInput() {
    type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
    type SpeechError = { error: string; message?: string };
    type SpeechRecognitionLike = {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onstart: (() => void) | null;
      onresult: ((event: SpeechResult) => void) | null;
      onerror: ((event: SpeechError) => void) | null;
      onend: (() => void) | null;
      onnomatch: (() => void) | null;
      start: () => void;
      stop: () => void;
      abort?: () => void;
    };
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      notify("Safari on this Mac may not support speech recognition. Open Shopping List in Google Chrome, or click the product box and use macOS Dictation.");
      return;
    }
    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      let receivedResult = false;
      let hadError = false;
      recognition.lang = "en-GB";
      // Capture one spoken product per session. Continuous recognition could
      // otherwise put the previous transcript back after the user presses Add.
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => setVoiceListening(true);
      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return;
        const last = event.results[event.results.length - 1];
        const words = last?.[0]?.transcript?.trim() || "";
        if (!words) return;
        receivedResult = true;
        // Detect spoken quantities such as "two notebooks", "notebooks two", or "notebooks two times".
        const parsed = parseSpokenProduct(words);
        setItemName(parsed.name);
        setQuantity(parsed.quantity);
      };
      recognition.onnomatch = () => notify("I couldn't make out those words. Please try again or type the product.");
      recognition.onerror = (event) => {
        hadError = true;
        const messages: Record<string, string> = {
          "not-allowed": "Microphone permission is blocked. Allow microphone access for this website in your browser settings.",
          "service-not-allowed": "The browser's speech service is unavailable. Try Chrome or keyboard dictation.",
          "no-speech": "No speech was detected. Check your microphone and try again.",
          "audio-capture": "No microphone could be accessed. Check your Mac microphone settings.",
          "network": "The speech service could not connect. Check your internet connection.",
          "language-not-supported": "English speech recognition is not supported by this browser.",
          "aborted": "Voice recording stopped.",
        };
        notify(messages[event.error] || `Voice recognition error: ${event.error}.`);
      };
      recognition.onend = () => {
        setVoiceListening(false);
        recognitionRef.current = null;
        if (!receivedResult && !hadError) notify("No product was recognised. Try again, or use your Mac keyboard dictation in the product box.");
      };
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setVoiceListening(false);
      console.error("Speech recognition start error:", error);
      notify("Couldn't start voice input. Check microphone permission and try again.");
    }
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  }

  async function readShoppingPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setPhotoPreview(URL.createObjectURL(file));
    let worker: { recognize: (image: string) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | undefined;
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing isn't available in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      // Preserve the original package colours; coloured product titles can be lost by greyscale conversion.
      const preparedImage = canvas.toDataURL("image/png");

      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (progress: { status?: string; progress?: number }) => {
          if (progress.status) console.info("Photo text reading:", progress.status, progress.progress ?? "");
        },
      });
      const result = await worker.recognize(preparedImage);
      // Keep the original reading order and treat each readable line as a possible
      // shopping-list entry. Only strip visible bullet/numbering markers, not a
      // leading quantity such as "2 milk".
      const rawLines = result.data.text
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim())
        .filter((line) => line.length > 2 && /[a-zA-Z]/.test(line));

      const packagingNoise = /\b(orderly|brand|professional|the whole world is using|sku|barcode|made in|www\.)\b/i;
      const cleanedLines = rawLines
        .filter((line) => !packagingNoise.test(line))
        .filter((line) => !/^[A-Z0-9-]{2,12}$/.test(line))
        .filter((line) => (line.match(/[a-z]/gi) || []).length / Math.max(1, line.length) > 0.45)
        .filter((line) => !/[|\\@]{3,}/.test(line));

      // Do not cap the result at three: a handwritten page may contain many
      // separate products. Preserve the page's reading order for user review.
      const lines = [...new Set(cleanedLines)].slice(0, 80);

      if (!lines.length) {
        notify("I couldn't read any clear product lines. Try a sharper, well-lit photo taken straight above the page, or type the products.");
      } else {
        const candidates = lines.map((line) => {
          const leadingQuantity = line.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
          const trailingQuantity = line.match(/^(.+?)\s+[x×]\s*(\d+)$/i);
          const quantityMatch = leadingQuantity || trailingQuantity;
          const name = leadingQuantity ? leadingQuantity[2] : trailingQuantity ? trailingQuantity[1] : line;
          const amount = quantityMatch ? Number(leadingQuantity ? leadingQuantity[1] : trailingQuantity?.[2]) : 1;
          return { id: uid(), name: name.trim(), quantity: Math.max(1, amount || 1), selected: true };
        }).filter((item) => item.name.length > 1);
        setPhotoItems(candidates);
        setShowPhotoReview(true);
        notify(`Found ${candidates.length} readable lines. Review them and untick anything you do not want to add.`);
      }
    } catch (error) {
      console.error("Shopping-list photo OCR error:", error);
      const detail = error instanceof Error ? error.message : String(error);
      if (detail.toLowerCase().includes("tesseract.js") || detail.toLowerCase().includes("module not found")) {
        notify("Photo reading needs the Tesseract package. In your project folder, run: npm install tesseract.js, then restart the website.");
      } else {
        notify(`Photo reading failed: ${detail.slice(0, 115)}. Check the connection and try again, or type the products.`);
      }
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      setPhotoBusy(false);
      event.target.value = "";
    }
  }

  function addPhotoItems() {
    if (!activeList) return;
    const selected = photoItems.filter((item) => item.selected && item.name.trim());
    if (!selected.length) {
      notify("Select at least one product before adding it.");
      return;
    }
    const newItems: Item[] = selected.map((item) => ({
      id: uid(), name: item.name.trim(), quantity: Math.max(1, item.quantity || 1), store: selectedStore, status: "pending", category: detectCategory(item.name, categories),
    }));
    updateActive((list) => ({ ...list, items: [...list.items, ...newItems] }));
    setPhotoItems([]); setPhotoPreview(""); setShowPhotoReview(false);
    notify(`${newItems.length} selected products added.`);
  }

  const groupedItems = stores
    .map((store) => ({
      store,
      categories: categories.map((category) => ({
        category,
        items: visibleItems.filter((item) => item.store === store && (item.category || detectCategory(item.name, categories)) === category),
      })).filter((group) => group.items.length > 0),
    }))
    .filter((group) => group.categories.length > 0);

  const unassignedCategories = categories.map((category) => ({
    category,
    items: visibleItems.filter((item) => !item.store && (item.category || detectCategory(item.name, categories)) === category),
  })).filter((group) => group.items.length > 0);
  const unassigned = unassignedCategories.flatMap((group) => group.items);

  const statusLabel = (status: Status) => {
    if (status === "purchased") return "Purchased";
    if (status === "unavailable") return "Unavailable";
    if (status === "skipped") return "Skipped";
    return "To buy";
  };

  return (
    <main className="min-h-screen bg-[#f7f5ed] text-[#183c2d]">
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button, input, select { font: inherit; }
        button { cursor: pointer; }
        .gold { color: #bd9851; }
        .panel { background: white; border: 1px solid #eae7dc; }
        .soft-shadow { box-shadow: 0 8px 30px rgba(24,60,45,.06); }
        .primary {
          background: #176b4a;
          color: white;
          border-radius: 12px;
          padding: 11px 18px;
          font-weight: 600;
        }
        .primary:hover { background: #10563b; }
        .secondary {
          background: #f3f5ef;
          color: #24533e;
          border: 1px solid #e0e8dd;
          border-radius: 10px;
          padding: 9px 13px;
        }
        .field {
          width: 100%;
          border: 1px solid #dedfd5;
          border-radius: 11px;
          padding: 12px 13px;
          outline: none;
          background: white;
          color: #183c2d;
        }
        .field:focus { border-color: #267b55; box-shadow: 0 0 0 3px #267b5518; }
        .custom-select, .item-select {
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235b7866' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 11px center;
          padding-right: 34px; cursor: pointer; min-height: 40px;
        }
        .item-select { min-width: 116px; border-radius: 12px; }
        .item-select:focus, .custom-select:focus { outline: none; border-color: #267b55; box-shadow: 0 0 0 3px #267b5518; }
        .nav-item {
          width: 100%;
          text-align: left;
          padding: 12px 14px;
          border-radius: 10px;
          color: #587063;
          font-size: 14px;
        }
        .nav-item:hover, .nav-active {
          background: #e9f1e9;
          color: #176b4a;
          font-weight: 700;
        }
        .add-product-grid { display:grid; grid-template-columns:minmax(260px,1fr) 112px minmax(190px,230px) 150px; align-items:end; gap:12px; }
        .add-product-grid > label { display:block; min-width:0; }
        .add-product-grid > label > span { display:block; margin:0 0 5px 3px; color:#7d8b7e; font-size:11px; font-weight:700; }
        .add-product-grid .field { min-height:48px; }
        .add-submit { min-height:48px; white-space:nowrap; }
        .product-row { display:grid; grid-template-columns:minmax(180px,1fr) 68px minmax(0,1.55fr); align-items:center; gap:14px; padding:12px 14px; border:1px solid #e9ede6; border-radius:12px; background:#fff; transition:border-color .15s ease,box-shadow .15s ease; }
        .product-row:hover { border-color:#cbd9cb; box-shadow:0 3px 12px rgba(24,60,45,.045); }
        .product-main { display:flex; min-width:0; align-items:center; gap:11px; }
        .product-check { display:flex; width:30px; height:30px; flex:0 0 30px; align-items:center; justify-content:center; border-radius:9px; background:#f5f3eb; color:#a98c52; font-size:17px; }
        .product-check-done { background:#eaf3eb; color:#176b4a; }
        .product-order { display:flex; align-items:center; justify-content:center; gap:5px; }
        .order-button { width:29px; height:29px; border:1px solid #e3e9e1; border-radius:8px; color:#58745f; background:#fff; }
        .order-button:hover { background:#f1f6f0; border-color:#b8cbb9; }
        .product-controls { display:grid; grid-template-columns:minmax(110px,1fr) minmax(110px,1fr) minmax(105px,.85fr) 26px; align-items:end; gap:8px; }
        .product-control { display:block; min-width:0; }
        .product-control > span { display:block; margin:0 0 4px 2px; color:#8a978b; font-size:10px; font-weight:600; }
        .product-select { width:100%; min-width:0; height:37px; border:1px solid #e3e8df; border-radius:9px; background-color:#fff; color:#315b45; padding:0 25px 0 9px; font-size:12px; }
        .delete-product { width:26px; height:36px; border-radius:8px; color:#a35f51; }
        .delete-product:hover { background:#fff1ee; }
        @media (max-width:1100px) {
          .add-product-grid { grid-template-columns:minmax(0,1fr) 100px; }
          .add-category { grid-column:1; }
          .add-submit { grid-column:2; grid-row:2; }
        }
        @media (max-width:600px) {
          .add-product-grid { grid-template-columns: minmax(0,1fr) 112px; gap:10px; align-items:end; }
          .add-name { grid-column:1 / -1; }
          .add-quantity { grid-column:1; grid-row:2; }
          .add-submit { grid-column:2; grid-row:2; min-height:48px; padding:10px 8px; font-size:14px; }
          .add-category { grid-column:1 / -1; grid-row:3; }
          .add-tools { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
          .add-tools button, .add-tools label { display:flex; align-items:center; justify-content:center; min-height:42px; white-space:nowrap; }
          .mobile-drawer { position:fixed; inset:0; z-index:60; display:flex; }
          .mobile-drawer-backdrop { position:absolute; inset:0; background:rgba(13,35,25,.42); }
          .mobile-drawer-panel { position:relative; width:min(82vw,320px); height:100%; overflow-y:auto; background:#fff; padding:22px 18px; box-shadow:12px 0 35px rgba(0,0,0,.14); }
          .mobile-drawer-panel .nav-item { padding:14px 12px; font-size:15px; }
          .mobile-main { padding-left:12px !important; padding-right:12px !important; padding-top:16px !important; }
          .mobile-list-panel { padding:15px !important; border-radius:18px !important; }
          .mobile-list-actions { display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px !important; }
          .mobile-list-actions button { padding:9px 5px; font-size:12px; }
          .product-row { border-radius:14px; padding:13px; box-shadow:0 2px 9px rgba(24,60,45,.035); }
          .product-main { align-items:flex-start; }
        }
        @media (min-width:601px) { .mobile-menu-button { display:none !important; } }
        @media (max-width:900px) {
          .product-row { grid-template-columns:minmax(0,1fr); gap:10px; padding:12px; }
          .product-main { grid-row:1; }
          .product-order { justify-content:flex-start; }
          .product-controls { grid-template-columns:repeat(2,minmax(0,1fr)) 26px; align-items:end; }
          .product-status-control { grid-column:1 / 3; }
          .delete-product { grid-column:3; grid-row:1; align-self:end; }
        }
        @media (max-width:420px) {
          .product-controls { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
          .product-status-control { grid-column:auto; }
          .delete-product { grid-column:2; grid-row:auto; justify-self:end; }
        }
        .print-sheet { display: none; }
        @media print {
          @page { size: A4; margin: 8mm 12mm; }
          html, body { background: #fff !important; color: #111 !important; margin: 0 !important; padding: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Hide the entire website, not just the controls inside the list panel. */
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; max-width: none !important; display: block !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
          .print-area > :not(.print-sheet) { display: none !important; }
          .print-sheet { display: block !important; width: 100% !important; background: #fff !important; color: #111 !important; font-family: Arial, sans-serif; }
          .print-brand { display: flex; justify-content: center; align-items: flex-start; margin: 0 0 5px; padding: 0; }
          .print-brand img { display: block; width: 76px; height: 48px; max-height: 48px; object-fit: contain; object-position: top center; }
          .print-title { display: block; width: 100%; margin: 0 0 8px; padding: 0 0 9px; border-bottom: 1px solid #aaa; color: #111 !important; font-size: 17pt; font-weight: 700; }
          .print-category { break-inside: avoid; page-break-inside: avoid; }
          .print-category h2 { margin: 14px 0 4px; padding: 0 0 4px; border-bottom: 1px solid #ccc; color: #333 !important; font-size: 11pt; font-weight: 700; }
          .print-table { display: table; width: 100% !important; table-layout: fixed; border-collapse: collapse; background: #fff !important; }
          .print-table th, .print-table td { padding: 9px 4px; border: 0; border-bottom: 1px solid #e2e2e2; background: #fff !important; color: #111 !important; font-size: 11pt; }
          .print-table th { font-weight: 700; text-align: left; }
          .print-table th:first-child, .print-table td:first-child { width: 78%; text-align: left; }
          .print-table th:last-child, .print-table td:last-child { width: 22%; text-align: right; white-space: nowrap; }
          .print-table tr { break-inside: avoid; page-break-inside: avoid; }
          .print-product-cell { display: flex; align-items: center; gap: 10px; }
          .print-product-image { width: 42px; height: 42px; object-fit: contain; border: 1px solid #e5e5e5; border-radius: 5px; padding: 2px; }
        }
      `}</style>

      {/* HEADER */}
      <header className="no-print sticky top-0 z-30 border-b border-[#e8e5d9] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="Shopping List logo" className="h-11 w-11 rounded-xl object-contain" />
            <div>
              <div className="text-xl font-extrabold tracking-tight text-[#174832]">
                Shopping <span className="gold">List</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[2px] text-[#9b875b]">
                Shop smarter. Live simpler.
              </div>
            </div>
          </div>
          <button type="button" className="mobile-menu-button secondary !flex h-11 w-11 items-center justify-center !rounded-xl !p-0 text-2xl" aria-label="Open navigation menu" onClick={() => setMobileMenuOpen(true)}>☰</button>
        </div>

      </header>

      {mobileMenuOpen && <div className="mobile-drawer lg:hidden"><button aria-label="Close navigation" className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)} /><aside className="mobile-drawer-panel no-print"><div className="mb-6 flex items-center justify-between"><span className="text-lg font-bold text-[#174832]">Menu</span><button className="secondary" onClick={() => setMobileMenuOpen(false)}>✕</button></div>{/* Mobile navigation */}<nav className="space-y-1">
        <button className="nav-item nav-active" onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>▦ &nbsp; Dashboard</button>
        <button className="nav-item" onClick={() => { setShowNewList(true); setMobileMenuOpen(false); }}>＋ &nbsp; Create a list</button>
        <button className="nav-item" onClick={() => { setFilter("all"); setShowListLibrary(true); setMobileMenuOpen(false); document.getElementById("shopping-lists")?.scrollIntoView({ behavior: "smooth" }); }}>☷ &nbsp; My shopping lists</button>
        <button className="nav-item" onClick={() => { setShowSchedule(true); setMobileMenuOpen(false); }}>◷ &nbsp; Shopping schedule</button>
      </nav><div className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-[1.7px] text-[#9a9d8d]">Your stores</div>{stores.map((store) => <div key={store} className="nav-item flex items-center gap-2"><span className="text-[#bd9851]">●</span>{store}</div>)}<button className="secondary mt-4 w-full" onClick={() => { setShowNewStore(true); setMobileMenuOpen(false); }}>＋ Add a new store</button></aside></div>}

      <div className="mx-auto grid max-w-[1800px] gap-7 px-4 py-6 md:px-7 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-8 lg:py-9">
        {/* SIDEBAR */}
        <aside className="no-print hidden min-w-0 lg:block">

          <nav className="space-y-1">
            <button className="nav-item nav-active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>▦ &nbsp; Dashboard</button>
            <button
              className="nav-item"
              onClick={() => setShowNewList(true)}
            >
              ＋ &nbsp; Create a list
            </button>
            <button
              className="nav-item"
              onClick={() => {
                setFilter("all");
                setShowListLibrary((open) => !open);
                window.setTimeout(() => document.getElementById("shopping-lists")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
            >
              ☷ &nbsp; My shopping lists
            </button>
            <button
              className="nav-item"
              onClick={() => setShowSchedule(true)}
            >
              ◷ &nbsp; Shopping schedule
            </button>
          </nav>

          <div className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-[1.7px] text-[#9a9d8d]">
            Your stores
          </div>
          <div className="space-y-1">
            {stores.slice(0, 5).map((store) => (
              <button
                key={store}
                className="nav-item flex items-center gap-2"
                onClick={() => {
                  setSearch("");
                  notify(store + " is available when adding products.");
                }}
              >
                <span className="text-[#bd9851]">●</span>
                {store}
              </button>
            ))}
          </div>

          <button
            className="secondary mt-3 w-full text-sm"
            onClick={() => setShowNewStore(true)}
          >
            ＋ Add a new store
          </button>

        </aside>

        {/* MAIN CONTENT */}
        <section className="mobile-main min-w-0">
          {/* LIST LIBRARY: opened from the sidebar, not permanently taking space */}
          {(showListLibrary || !activeList) && <div className="mb-7" id="shopping-lists">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#174832]">My shopping lists</h2>
                <p className="mt-1 text-xs text-[#839085]">Choose a list to open it.</p>
              </div>
              <button className="primary text-sm" onClick={() => setShowNewList(true)}>＋ Create list</button>
            </div>
            {lists.length === 0 ? (
              <div className="panel rounded-2xl px-6 py-10 text-center soft-shadow">
                <div className="mb-3 text-4xl">🛍️</div>
                <h3 className="text-lg font-bold text-[#174832]">Create your first shopping list</h3>
                <button className="primary mt-4" onClick={() => setShowNewList(true)}>Create list</button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {lists.map((list) => <button key={list.id} onClick={() => { setActiveId(list.id); setSearch(""); setFilter("all"); setShowListLibrary(false); }} className={`rounded-2xl border p-4 text-left transition ${activeId === list.id ? "border-[#176b4a] bg-[#edf5ed]" : "panel hover:border-[#b6c9b8]"}`}>
                  <div className="flex items-center justify-between"><span className="text-lg">🛒</span>{activeId === list.id && <span className="text-xs font-bold text-[#176b4a]">OPEN ✓</span>}</div>
                  <div className="mt-3 font-bold text-[#174832]">{list.name}</div>
                  <div className="mt-1 text-xs text-[#829084]">{list.items.length} products{list.date ? ` · ${list.date}` : ""}</div>
                </button>)}
              </div>
            )}
          </div>}

          {/* ACTIVE LIST */}
          {activeList && (
            <div className="print-area mobile-list-panel panel rounded-2xl p-4 soft-shadow md:p-6">
              <div className="print-sheet">
                <div className="print-brand">
                  <img src="/logo.jpeg" alt="Shopping List logo" />
                </div>
                <h1 className="print-title">{selectedStore || activeList.name}</h1>
                {categories.map((category) => {
                  const categoryItems = activeList.items.filter((item) => (!selectedStore || item.store === selectedStore) && (item.category || detectCategory(item.name, categories)) === category);
                  if (!categoryItems.length) return null;
                  return <section key={category} className="print-category"><h2>{category}</h2><table className="print-table"><thead><tr><th>Product</th><th>Quantity</th></tr></thead><tbody>{categoryItems.map((item) => <tr key={item.id}><td><div className="print-product-cell">{item.image && <img className="print-product-image" src={item.image} alt="" />}<span>{item.name}</span></div></td><td>{item.quantity}</td></tr>)}</tbody></table></section>;
                })}
                {(selectedStore ? activeList.items.filter((item) => item.store === selectedStore) : activeList.items).length === 0 && <p>No products for this selection.</p>}
              </div>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[1.5px] text-[#bd9851]">
                    CURRENT SHOPPING LIST
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#174832]">
                    {activeList.name}
                  </h2>
                  {activeList.date && (
                    <p className="mt-2 text-xs text-[#718074]">
                      ◷ Shopping: {activeList.date}
                    </p>
                  )}
                </div>

                <div className="no-print mobile-list-actions flex flex-wrap gap-2">
                  <button className="secondary text-xs" onClick={renameList}>
                    Rename
                  </button>
                  <button
                    className="secondary text-xs"
                    onClick={() => {
                      setScheduleDate(
                        activeList.date.split(" at ")[0] || ""
                      );
                      setScheduleTime(
                        activeList.date.split(" at ")[1] || ""
                      );
                      setShowSchedule(true);
                    }}
                  >
                    ◷ Schedule
                  </button>
                  <button className="secondary text-xs" onClick={shareList}>
                    ↗ Share
                  </button>
                  <button className="secondary text-xs" onClick={copyList}>
                    Copy
                  </button>
                  <button className="secondary text-xs" onClick={printList}>
                    Print
                  </button>
                  <button
                    className="secondary text-xs"
                    onClick={() => deleteList(activeList.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* ADD PRODUCT */}
              <div className="no-print mt-7 rounded-xl bg-[#f6f7f1] p-4">
                <h3 className="mb-3 text-sm font-bold text-[#174832]">
                  ＋ Add a product
                </h3>

                <div className="add-tools mb-3 flex flex-wrap gap-2">
                  <button type="button" className="secondary text-xs" onClick={startVoiceInput} disabled={voiceListening}>🎙 Speak product</button>
                  {voiceListening && <><span className="self-center text-xs font-medium text-[#176b4a]">Listening… say the product, then press Stop.</span><button type="button" className="secondary text-xs" onClick={stopVoiceInput}>Stop listening</button></>}
                  <label className="secondary cursor-pointer text-xs">📷 Take photo / Upload picture
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={readShoppingPhoto} />
                  </label>
                  {photoBusy && <span className="self-center text-xs text-[#718074]">Reading picture…</span>}
                </div>
                <div className="add-product-grid">
                  <input className="field add-name" placeholder="What do you need to buy?" value={itemName} onChange={(event) => setItemName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }} />
                  <label className="add-quantity"><span>Qty</span><input className="field" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} aria-label="Quantity" /></label>
                  <label className="add-category"><span>Category</span><select className="field custom-select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="Product category"><option value="auto">Automatic</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                  <button className="primary add-submit" onClick={addItem}>Add product</button>
                </div>
                <div className="mt-2 flex justify-between gap-3 text-[11px] text-[#879286]">
                  <span>Enter a product name and quantity.</span>
                  <button className="font-semibold text-[#176b4a]" onClick={() => setShowNewCategory(true)}>＋ Add a category</button>
                </div>
              </div>

              {/* PRODUCT GROUPS */}
              <div className="no-print mt-5 hidden items-center gap-3 rounded-xl bg-[#edf3eb] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[#58745f] lg:flex">
                <span className="min-w-0 flex-1">Product</span><span className="w-[58px] text-center">Order</span><span className="grid flex-[1.55] grid-cols-[1fr_1fr_.85fr_26px] gap-2"><span>Category</span><span>Store</span><span>Status</span><span /></span>
              </div>
              <div className="mt-3 space-y-6">
                {groupedItems.map((group) => (
                  <div key={group.store}>
                    <div className="mb-3 flex items-center justify-between border-b border-[#eee] pb-2">
                      <h3 className="font-bold text-[#174832]">● &nbsp;{group.store}</h3>
                      <span className="text-xs text-[#829084]">{group.categories.reduce((sum, category) => sum + category.items.length, 0)} products</span>
                    </div>
                    {group.categories.map((category) => <section key={category.category} className="mb-5">
                      <div className="mb-2 flex items-center gap-3 border-b border-[#e9ede6] pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-[1.2px] text-[#7c8b7e]">{category.category}</h4>
                        <span className="rounded-full bg-[#f1f5ef] px-2 py-0.5 text-[11px] font-semibold text-[#58745f]">{category.items.length}</span>
                      </div>
                      <div className="space-y-2">{category.items.map((item) => <ProductRow key={item.id} item={item} updateItem={updateItem} deleteItem={deleteItem} statusLabel={statusLabel} stores={stores} categories={categories} onDragStart={() => setDraggedItemId(item.id)} onDrop={() => { if (draggedItemId) moveItem(draggedItemId, item.id); setDraggedItemId(null); }} onMoveUp={() => moveItemBy(item.id, -1)} onMoveDown={() => moveItemBy(item.id, 1)} />)}</div>
                    </section>)}
                  </div>
                ))}

                {unassigned.length > 0 && (
                  <div>
                    <h3 className="mb-3 border-b border-[#eee] pb-2 font-bold text-[#174832]">
                      ◇ &nbsp;Store not decided
                    </h3>
                    {unassignedCategories.map((category) => <section key={category.category} className="mb-5">
                      <div className="mb-2 flex items-center gap-3 border-b border-[#e9ede6] pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-[1.2px] text-[#7c8b7e]">{category.category}</h4>
                        <span className="rounded-full bg-[#f1f5ef] px-2 py-0.5 text-[11px] font-semibold text-[#58745f]">{category.items.length}</span>
                      </div>
                      <div className="space-y-2">{category.items.map((item) => <ProductRow key={item.id} item={item} updateItem={updateItem} deleteItem={deleteItem} statusLabel={statusLabel} stores={stores} categories={categories} onDragStart={() => setDraggedItemId(item.id)} onDrop={() => { if (draggedItemId) moveItem(draggedItemId, item.id); setDraggedItemId(null); }} onMoveUp={() => moveItemBy(item.id, -1)} onMoveDown={() => moveItemBy(item.id, 1)} />)}</div>
                    </section>)}
                  </div>
                )}

                {visibleItems.length === 0 && (
                  <div className="py-9 text-center text-sm text-[#879286]">
                    {activeList.items.length
                      ? "No products match your search or filter."
                      : "Your list is empty. Add your first product above."}
                  </div>
                )}
              </div>


            </div>
          )}

          {/* FOOTER */}
          <footer className="mt-10 border-t border-[#e6e2d6] py-6 text-center text-xs text-[#899186]">
            <span className="font-bold text-[#174832]">Shopping List</span>
            <span className="gold"> · </span>
            Shop smarter. Live simpler.
            <div className="mt-2">
              Your shopping, beautifully organised.
            </div>
            <div className="mt-3 text-[11px] font-semibold tracking-wide text-[#9b875b]">
              Created by Usama
            </div>
          </footer>
        </section>
      </div>

      {/* PHOTO OCR REVIEW */}
      {showPhotoReview && (
        <Modal title="Check items from your photo" close={() => setShowPhotoReview(false)}>
          <p className="mb-3 text-sm text-[#829084]">We have preselected the readable lines from your page. Check each line, untick anything that is not a product, and edit names or quantities before adding.</p>
          {photoPreview && <img src={photoPreview} alt="Uploaded shopping list" className="mb-3 max-h-40 w-full rounded-xl bg-[#f8f8f5] object-contain" />}
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {photoItems.map((item) => (
              <div key={item.id} className={`grid grid-cols-[24px_minmax(0,1fr)_84px] items-center gap-2 rounded-xl border p-3 ${item.selected ? "border-[#8caf96] bg-[#f7fbf7]" : "border-[#e8e9e2] bg-white"}`}>
                <input type="checkbox" aria-label={`Select ${item.name}`} checked={item.selected} onChange={(e) => setPhotoItems((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, selected: e.target.checked } : candidate))} className="h-4 w-4 accent-[#176b4a]" />
                <input className="field min-w-0" aria-label="Product name" value={item.name} onChange={(e) => setPhotoItems((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, name: e.target.value } : candidate))} />
                <input className="field text-center" aria-label="Quantity" type="number" min="1" value={item.quantity} onChange={(e) => setPhotoItems((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, quantity: Math.max(1, Number(e.target.value) || 1) } : candidate))} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#718074]"><span>{photoItems.filter((item) => item.selected).length} selected</span><button type="button" className="font-semibold text-[#176b4a]" onClick={() => setPhotoItems((items) => items.map((item) => ({ ...item, selected: true })))}>Select all</button></div>
          <button className="primary mt-4 w-full" onClick={addPhotoItems} disabled={!photoItems.some((item) => item.selected && item.name.trim())}>Add selected products</button>
        </Modal>
      )}

      {/* NEW LIST MODAL */}
      {showNewList && (
        <Modal title="Create a shopping list" close={() => setShowNewList(false)}>
          <p className="mb-4 text-sm text-[#829084]">
            Give your list a name. You can add products and stores afterwards.
          </p>
          <input
            autoFocus
            className="field"
            placeholder="e.g. Weekly shopping"
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createList();
            }}
          />
          <button
            className="primary mt-4 w-full"
            onClick={createList}
            disabled={!newListName.trim()}
          >
            Create list
          </button>
        </Modal>
      )}

      {/* NEW CATEGORY MODAL */}
      {showNewCategory && (
        <Modal title="Add a product category" close={() => setShowNewCategory(false)}>
          <p className="mb-4 text-sm text-[#829084]">Create a category for products that do not fit the existing groups.</p>
          <input autoFocus className="field" placeholder="e.g. Garden supplies" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); }} />
          <button className="primary mt-4 w-full" onClick={addCategory} disabled={!newCategory.trim()}>Add category</button>
        </Modal>
      )}

      {/* NEW STORE MODAL */}
      {showNewStore && (
        <Modal title="Add a new store" close={() => setShowNewStore(false)}>
          <p className="mb-4 text-sm text-[#829084]">
            Add any supermarket, local shop, pharmacy or other retailer.
          </p>
          <input
            autoFocus
            className="field"
            placeholder="Enter store name"
            value={newStore}
            onChange={(event) => setNewStore(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addStore();
            }}
          />
          <button
            className="primary mt-4 w-full"
            onClick={addStore}
            disabled={!newStore.trim()}
          >
            Add store
          </button>
        </Modal>
      )}

      {/* SCHEDULE MODAL */}
      {showSchedule && activeList && (
        <Modal title="Schedule your shopping" close={() => setShowSchedule(false)}>
          <p className="mb-4 text-sm text-[#829084]">
            Choose when you plan to go shopping.
          </p>
          <label className="mb-2 block text-xs font-semibold text-[#547060]">
            Shopping date
          </label>
          <input
            type="date"
            className="field mb-4"
            value={scheduleDate}
            onChange={(event) => setScheduleDate(event.target.value)}
          />
          <label className="mb-2 block text-xs font-semibold text-[#547060]">
            Optional time
          </label>
          <input
            type="time"
            className="field"
            value={scheduleTime}
            onChange={(event) => setScheduleTime(event.target.value)}
          />
          <button className="primary mt-4 w-full" onClick={saveSchedule}>
            Save schedule
          </button>
          {activeList.date && (
            <button
              className="mt-3 w-full rounded-xl border border-[#e4e4da] p-3 text-sm text-[#8b594d]"
              onClick={() => {
                updateActive((list) => ({ ...list, date: "" }));
                setShowSchedule(false);
                notify("Schedule removed.");
              }}
            >
              Remove schedule
            </button>
          )}
        </Modal>
      )}

      {/* TOAST */}
      {message && (
        <div className="no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#174b36] px-5 py-3 text-sm font-medium text-white shadow-xl">
          ✓ &nbsp;{message}
        </div>
      )}
    </main>
  );
}

function ProductRow({
  item, updateItem, deleteItem, statusLabel, stores, categories,
  onDragStart, onDrop, onMoveUp, onMoveDown,
}: {
  item: Item;
  updateItem: (id: string, changes: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  statusLabel: (status: Status) => string;
  stores: string[];
  categories: string[];
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [draftQuantity, setDraftQuantity] = useState(String(item.quantity));
  const saveQuantity = () => {
    updateItem(item.id, { quantity: Math.max(1, Number(draftQuantity) || 1) });
    setEditingQuantity(false);
  };
  return (
    <div draggable
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); onDragStart(); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
      onDrop={(event) => { event.preventDefault(); onDrop(); }}
      className="product-row group">
      <div className="product-main">
        <span className={`product-check ${item.status === "purchased" ? "product-check-done" : ""}`}>{item.status === "purchased" ? "✓" : "○"}</span>
        <div className="min-w-0 flex-1">
          <div className={`break-words text-sm font-semibold leading-5 ${item.status === "purchased" ? "text-[#8b9a8e] line-through" : "text-[#244936]"}`}>{item.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#89958a]">
            {editingQuantity ? (
              <input autoFocus type="number" min="1" value={draftQuantity}
                onChange={(event) => setDraftQuantity(event.target.value)}
                onBlur={saveQuantity}
                onKeyDown={(event) => { if (event.key === "Enter") saveQuantity(); if (event.key === "Escape") setEditingQuantity(false); }}
                aria-label={`Quantity for ${item.name}`}
                className="w-20 rounded-lg border border-[#cbd8ce] bg-white px-2 py-1 text-sm text-[#244936]" />
            ) : (
              <button type="button" className="inline-flex items-center gap-1 hover:text-[#176b4a]"
                onClick={() => { setDraftQuantity(String(item.quantity)); setEditingQuantity(true); }}
                aria-label={`Change quantity for ${item.name}`}>Qty: {item.quantity} <span className="text-[10px]">✎ Edit</span></button>
            )}
            <span>·</span><span>{statusLabel(item.status)}</span>
          </div>
        </div>
        {item.image && <img src={item.image} alt={`${item.name} product`} className="h-12 w-12 shrink-0 rounded-lg border border-[#e8e8e2] bg-white object-contain p-1" />}
      </div>
      <div className="product-order no-print">
        <button type="button" className="order-button" aria-label={`Move ${item.name} up`} onClick={onMoveUp}>↑</button>
        <button type="button" className="order-button" aria-label={`Move ${item.name} down`} onClick={onMoveDown}>↓</button>
      </div>
      <div className="product-controls no-print">
        <label className="product-control"><span className="lg:hidden">Category</span>
          <select aria-label={`Category for ${item.name}`} className="product-select" value={item.category || detectCategory(item.name, categories)} onChange={(event) => updateItem(item.id, { category: event.target.value })}>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="product-control"><span className="lg:hidden">Store</span>
          <select aria-label={`Store for ${item.name}`} className="product-select" value={item.store} onChange={(event) => updateItem(item.id, { store: event.target.value })}>
            <option value="">No store</option>
            {stores.map((store) => <option key={store} value={store}>{store}</option>)}
          </select>
        </label>
        <label className="product-control product-status-control"><span className="lg:hidden">Status</span>
          <select aria-label={`Status for ${item.name}`} className="product-select" value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as Status })}>
            <option value="pending">To buy</option><option value="purchased">Purchased</option><option value="unavailable">Unavailable</option><option value="skipped">Skipped</option>
          </select>
        </label>
        <button className="delete-product" onClick={() => deleteItem(item.id)} aria-label={`Delete ${item.name}`}>✕</button>
      </div>
    </div>
  );
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#102d20]/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#174832]">{title}</h2>
          <button
            className="rounded-lg px-3 py-2 text-[#829084] hover:bg-[#f2f4ee]"
            onClick={close}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
