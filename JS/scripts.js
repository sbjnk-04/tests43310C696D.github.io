"use strict";

/*
 * Choices page: a two-step chooser (instrument family, then instrument).
 * Each click swaps the content of <main> in place. No page navigation happens.
 * All instrument information is loaded from a JSON file with fetch().
 */

/* ---------- Constants ---------- */

const DATA_URL = "../JS/choices.json";   // relative to choices/index.html
const IMAGE_DIR = "../img/";
const EXTRA_INFO_URL = "../extra_info/index.html";
const FETCH_TIMEOUT_MS = 10000;

// Ids of the elements in choices/index.html that this script updates.
const ELEMENT_IDS = {
    appRoot: "app",
    prompt: "prompt",
    backButton: "back"
};

// Class names, shared with css/style.css.
const CSS_CLASSES = {
    choiceRow: "families",
    choiceButton: "family",
    choiceLabel: "family_name",
    cardList: "cards",
    card: "card",
    figure: "img_container",
    imageBox: "img_box",
    clefOnlyBox: "clef_box",
    instrumentImage: "instrument_img",
    rangeImage: "range_img",
    clefImage: "clef_img",
    seatingImage: "seating_img",
    songList: "songs",
    song: "song",
    songImage: "song_img",
    nextSteps: "next_steps",
    actionButton: "action_button",
    visuallyHidden: "visually_hidden",
    statusMessage: "status_message"
};

// Text shown to the user.
const MESSAGES = {
    loading: "Loading instruments...",
    chooseFamily: "Choose an instrument family to start.",
    backToFamilies: "\u2190 Back to families",
    loadFailed: "Sorry, the instrument data could not be loaded.",
    retry: "Try again",
    chooseDifferentFamily: "Choose a different family",
    reviewBasics: "Review the music theory basics",
    nextStepsHeading: "What would you like to do next?",
    rangeAndClefHeading: "Musical range and clef",
    piecesHeading: "Popular songs/pieces that feature the instrument:",
    referencesHeading: "References",
    opensInNewTab: " (opens in a new tab)"
};

/* ---------- Building blocks for the page content ---------- */

/**
 * Creates an element with attributes and children.
 * @param {string} tagName - the HTML tag to create
 * @param {Object} attributes - attribute names and values (use "class" for CSS classes)
 * @param {...(Node|string)} children - nodes or text to append
 * @returns {HTMLElement} the new element
 */
function createElement(tagName, attributes = {}, ...children) {
    const element = document.createElement(tagName);
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }
    element.append(...children);
    return element;
}

/**
 * Creates a captioned image.
 * @param {{src: string, alt: string, caption: string}} image - image data from the JSON file
 * @param {string} imageClass - CSS class for the <img>
 * @returns {HTMLElement} a <figure> element
 */
function createFigure(image, imageClass) {
    return createElement("figure", { class: CSS_CLASSES.figure },
        createElement("img", { src: IMAGE_DIR + image.src, alt: image.alt, class: imageClass }),
        createElement("figcaption", {}, image.caption));
}

/**
 * Creates a superscript footnote marker that points at a reference below.
 * @param {number} number - the footnote number (1-based)
 * @returns {HTMLElement} a <sup> element
 */
function createFootnoteMarker(number) {
    const link = createElement("a",
        { href: `#fn${number}`, id: `ref${number}`, title: "Jump to footnote" }, `[${number}]`);
    return createElement("sup", {}, link);
}

/**
 * Creates a large, touch-friendly button for the two choice steps.
 * @param {{id: string, name: string}} choice - a family or instrument from the JSON file
 * @param {function(Object): void} onChoose - called with the choice when the button is clicked
 * @returns {HTMLButtonElement} the button
 */
function createChoiceButton(choice, onChoose) {
    const button = createElement("button",
        { type: "button", class: `${CSS_CLASSES.choiceButton} ${choice.id}` },
        createElement("span", { class: CSS_CLASSES.choiceLabel }, choice.name));
    button.addEventListener("click", () => onChoose(choice));
    return button;
}

/**
 * Creates the row of choice buttons for a step.
 * @param {Array<{id: string, name: string}>} choices - families or instruments
 * @param {function(Object): void} onChoose - called with the clicked choice
 * @returns {HTMLElement} a <div> holding one button per choice
 */
function createChoiceRow(choices, onChoose) {
    const row = createElement("div", { class: CSS_CLASSES.choiceRow });
    row.append(...choices.map(choice => createChoiceButton(choice, onChoose)));
    return row;
}

/**
 * Creates a standard action button.
 * @param {string} label - the button text
 * @param {function(): void} onClick - called when the button is clicked
 * @returns {HTMLButtonElement} the button
 */
function createActionButton(label, onClick) {
    const button = createElement("button",
        { type: "button", class: CSS_CLASSES.actionButton }, label);
    button.addEventListener("click", onClick);
    return button;
}

/* ---------- Cards that make up the details view ---------- */

/**
 * Creates the "What is ...?" card.
 * @param {Object} instrument - one instrument from the JSON file
 * @returns {HTMLElement} a <section> card
 */
function createIntroCard(instrument) {
    return createElement("section", { class: CSS_CLASSES.card },
        createFigure(instrument.image, CSS_CLASSES.instrumentImage),
        createElement("h2", {}, instrument.whatTitle),
        createElement("p", {}, instrument.intro, createFootnoteMarker(1)));
}

/**
 * Creates the range and clef card. Unpitched instruments have no range image,
 * so their image box only shows the clef.
 * @param {Object} instrument - one instrument from the JSON file
 * @returns {HTMLElement} a <section> card
 */
function createRangeCard(instrument) {
    const hasRangeImage = instrument.range.image !== null;
    const boxClasses = hasRangeImage
        ? CSS_CLASSES.imageBox
        : `${CSS_CLASSES.imageBox} ${CSS_CLASSES.clefOnlyBox}`;
    const imageBox = createElement("div", { class: boxClasses });
    if (hasRangeImage) {
        imageBox.append(createFigure(instrument.range.image, CSS_CLASSES.rangeImage));
    }
    imageBox.append(createFigure(instrument.clef.image, CSS_CLASSES.clefImage));

    return createElement("section", { class: CSS_CLASSES.card },
        imageBox,
        createElement("h2", {}, MESSAGES.rangeAndClefHeading),
        createElement("p", {}, instrument.range.text, createFootnoteMarker(2)),
        createElement("p", {}, instrument.clef.text, createFootnoteMarker(3)));
}

/**
 * Creates the orchestra seating card.
 * @param {Object} instrument - one instrument from the JSON file
 * @returns {HTMLElement} a <section> card
 */
function createSeatingCard(instrument) {
    return createElement("section", { class: CSS_CLASSES.card },
        createFigure(instrument.seating.image, CSS_CLASSES.seatingImage),
        createElement("h2", {}, instrument.seatTitle),
        createElement("p", {}, instrument.seating.text, createFootnoteMarker(4)));
}

/**
 * Creates one clickable cover that links to a piece of music.
 * @param {{composer: string, title: string, cover: string, url: string, alt: string}} piece - a piece from the JSON file
 * @returns {HTMLElement} a <figure> element
 */
function createPieceFigure(piece) {
    const link = createElement("a", { href: piece.url, target: "_blank", rel: "noopener" },
        createElement("img", { src: IMAGE_DIR + piece.cover, alt: piece.alt, class: CSS_CLASSES.songImage }),
        createElement("span", { class: CSS_CLASSES.visuallyHidden }, MESSAGES.opensInNewTab));
    const caption = createElement("figcaption", {},
        createElement("strong", {}, piece.composer), createElement("br"), piece.title);
    return createElement("figure", { class: CSS_CLASSES.song }, link, caption);
}

/**
 * Creates the card of pieces that feature the instrument.
 * @param {Object} instrument - one instrument from the JSON file
 * @returns {HTMLElement} a <section> card
 */
function createPiecesCard(instrument) {
    const songList = createElement("div", { class: CSS_CLASSES.songList });
    songList.append(...instrument.pieces.map(createPieceFigure));
    return createElement("section", { class: CSS_CLASSES.card },
        createElement("h2", {}, MESSAGES.piecesHeading), songList);
}

/**
 * Creates the numbered reference list; item numbers match the footnote markers.
 * @param {Object} instrument - one instrument from the JSON file
 * @returns {HTMLElement} a <section> card
 */
function createReferencesCard(instrument) {
    const list = createElement("ol");
    instrument.references.forEach((reference, index) => {
        const link = createElement("a", { href: reference.url }, reference.title);
        list.append(createElement("li", { id: `fn${index + 1}` },
            `${reference.source}, \u201C`, link, "\u201D."));
    });
    return createElement("section", { class: CSS_CLASSES.card },
        createElement("h2", {}, MESSAGES.referencesHeading), list);
}

/**
 * Creates the closing card so the user always has a next thing to do.
 * @param {Object} family - the chosen family
 * @param {function(): void} onPickInstrument - go back to this family's instruments
 * @param {function(): void} onPickFamily - go back to the family choices
 * @returns {HTMLElement} a <section> card
 */
function createNextStepsCard(family, onPickInstrument, onPickFamily) {
    const actions = createElement("div", { class: CSS_CLASSES.nextSteps },
        createActionButton(`Explore another ${family.name.toLowerCase()} instrument`, onPickInstrument),
        createActionButton(MESSAGES.chooseDifferentFamily, onPickFamily),
        createElement("a", { href: EXTRA_INFO_URL, class: CSS_CLASSES.actionButton }, MESSAGES.reviewBasics));
    return createElement("section", { class: CSS_CLASSES.card },
        createElement("h2", {}, MESSAGES.nextStepsHeading), actions);
}

/* ---------- Showing content on the page ---------- */

/**
 * Finds the page elements this script updates.
 * @returns {{appRoot: HTMLElement, promptElement: HTMLElement, backButton: HTMLButtonElement}}
 */
function findPageElements() {
    return {
        appRoot: document.getElementById(ELEMENT_IDS.appRoot),
        promptElement: document.getElementById(ELEMENT_IDS.prompt),
        backButton: document.getElementById(ELEMENT_IDS.backButton)
    };
}

/**
 * Shows, relabels or hides the Back button.
 * @param {HTMLButtonElement} backButton - the header's Back button
 * @param {?{label: string, onBack: function(): void}} backSettings - null hides the button
 */
function updateBackButton(backButton, backSettings) {
    backButton.hidden = backSettings === null;
    backButton.onclick = backSettings === null ? null : backSettings.onBack;
    if (backSettings !== null) {
        backButton.textContent = backSettings.label;
    }
}

/**
 * Replaces the page content and the prompt text. The prompt gets keyboard focus
 * after a click so screen readers announce the change.
 * @param {Object} pageElements - result of findPageElements()
 * @param {Node} content - the new content for <main>
 * @param {string} promptText - the sentence shown in the header
 * @param {?Object} backSettings - see updateBackButton()
 * @param {boolean} shouldMoveFocus - true after a user action, false on first load
 */
function displayContent(pageElements, content, promptText, backSettings, shouldMoveFocus) {
    pageElements.promptElement.textContent = promptText;
    pageElements.appRoot.replaceChildren(content);
    pageElements.appRoot.removeAttribute("aria-busy");
    updateBackButton(pageElements.backButton, backSettings);
    if (shouldMoveFocus) {
        pageElements.promptElement.focus();
    }
    window.scrollTo(0, 0);
}

/**
 * Shows a loading message. The rest of the page (navigation) stays usable.
 * @param {Object} pageElements - result of findPageElements()
 */
function showLoadingMessage(pageElements) {
    pageElements.appRoot.setAttribute("aria-busy", "true");
    pageElements.promptElement.textContent = MESSAGES.loading;
    updateBackButton(pageElements.backButton, null);
    pageElements.appRoot.replaceChildren(
        createElement("p", { class: CSS_CLASSES.statusMessage, role: "status" }, MESSAGES.loading));
}

/**
 * Shows an error message with a button to try loading again.
 * @param {Object} pageElements - result of findPageElements()
 * @param {function(): void} onRetry - called when the user presses "Try again"
 */
function showLoadError(pageElements, onRetry) {
    pageElements.appRoot.removeAttribute("aria-busy");
    pageElements.promptElement.textContent = MESSAGES.loadFailed;
    const message = createElement("div", { class: CSS_CLASSES.statusMessage, role: "alert" },
        createElement("p", {}, MESSAGES.loadFailed),
        createActionButton(MESSAGES.retry, onRetry));
    pageElements.appRoot.replaceChildren(message);
}

/* ---------- The two steps and the final view ---------- */

/**
 * Step 1: shows one button per instrument family.
 * @param {{pageElements: Object, families: Array}} context - page elements and loaded data
 * @param {boolean} shouldMoveFocus - see displayContent()
 */
function showFamilyStep(context, shouldMoveFocus) {
    const row = createChoiceRow(context.families,
        family => showStep(context, { family, instrument: null }, true));
    displayContent(context.pageElements, row, MESSAGES.chooseFamily, null, shouldMoveFocus);
}

/**
 * Step 2: shows one button per instrument in the chosen family.
 * @param {{pageElements: Object, families: Array}} context - page elements and loaded data
 * @param {Object} family - the chosen family
 */
function showInstrumentStep(context, family) {
    const row = createChoiceRow(family.instruments,
        instrument => showStep(context, { family, instrument }, true));
    const backSettings = {
        label: MESSAGES.backToFamilies,
        onBack: () => showStep(context, { family: null, instrument: null }, true)
    };
    displayContent(context.pageElements, row,
        `Now pick a ${family.name.toLowerCase()} instrument.`, backSettings, true);
}

/**
 * Final view: all of the information about the chosen instrument.
 * @param {{pageElements: Object, families: Array}} context - page elements and loaded data
 * @param {Object} family - the chosen family
 * @param {Object} instrument - the chosen instrument
 */
function showDetailStep(context, family, instrument) {
    const showFamilyInstruments = () => showStep(context, { family, instrument: null }, true);
    const showFamilies = () => showStep(context, { family: null, instrument: null }, true);

    const cards = createElement("div", { class: CSS_CLASSES.cardList });
    cards.append(
        createIntroCard(instrument),
        createRangeCard(instrument),
        createSeatingCard(instrument),
        createPiecesCard(instrument),
        createReferencesCard(instrument),
        createNextStepsCard(family, showFamilyInstruments, showFamilies));

    const backSettings = {
        label: `\u2190 Back to ${family.name.toLowerCase()}`,
        onBack: showFamilyInstruments
    };
    displayContent(context.pageElements, cards,
        `You picked ${instrument.name.toLowerCase()}!`, backSettings, true);
}

/**
 * Shows the step that matches the user's choices so far. Each click handler
 * calls this again, which is how the page moves between steps without reloading.
 * @param {{pageElements: Object, families: Array}} context - page elements and loaded data
 * @param {{family: ?Object, instrument: ?Object}} selection - what the user has picked
 * @param {boolean} shouldMoveFocus - see displayContent()
 */
function showStep(context, selection, shouldMoveFocus) {
    if (selection.family === null) {
        showFamilyStep(context, shouldMoveFocus);
    } else if (selection.instrument === null) {
        showInstrumentStep(context, selection.family);
    } else {
        showDetailStep(context, selection.family, selection.instrument);
    }
}

/* ---------- Loading the data ---------- */

/**
 * Loads the instrument data with an AJAX request.
 * @returns {Promise<Array>} resolves with the list of families
 * @throws {Error} if the request fails, times out, or the data has the wrong shape
 */
async function fetchInstrumentFamilies() {
    const response = await fetch(DATA_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data.families)) {
        throw new Error("The instrument data has no list of families.");
    }
    return data.families;
}

/**
 * Loads the data, then starts the two-step chooser. Shows a loading message
 * while waiting and an error with a retry button if loading fails.
 * @param {Object} pageElements - result of findPageElements()
 */
async function loadAndStart(pageElements) {
    showLoadingMessage(pageElements);
    try {
        const families = await fetchInstrumentFamilies();
        const context = { pageElements, families };
        showStep(context, { family: null, instrument: null }, false);
    } catch {
        showLoadError(pageElements, () => loadAndStart(pageElements));
    }
}

loadAndStart(findPageElements());