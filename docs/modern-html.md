# Modern HTML (2024-2026)

## Customizable Select (Chrome 135+)

Native, styleable select dropdowns. Opt in with CSS.

```css
/* Enable customizable select */
select,
::picker(select) {
  appearance: base-select;
}
```

### HTML Structure

```html
<select>
  <!-- Custom button (optional) -->
  <button>
    <selectedcontent></selectedcontent>
  </button>

  <!-- Rich option content -->
  <option value="html">
    <span class="icon">HTML</span>
  </option>
  <option value="css">
    <span class="icon">CSS</span>
  </option>
</select>
```

### CSS Pseudo-Elements

```css
/* The dropdown picker */
::picker(select) {
  border: 2px solid var(--border);
  padding: 0.5rem;
}

/* Dropdown arrow icon */
select::picker-icon {
  transition: rotate 200ms;
}

select:open::picker-icon {
  rotate: 180deg;
}

/* Checkmark on selected option */
option::checkmark {
  content: "check";
  margin-left: auto;
}

/* Style selected option */
option:checked {
  font-weight: bold;
}
```

## Popover API

Native popovers with light dismiss, no JavaScript required.

```html
<button popovertarget="menu">Open Menu</button>

<div id="menu" popover>
  <p>Popover content</p>
</div>
```

### Popover Types

```html
<!-- Auto: light dismiss (click outside or Escape) -->
<div popover="auto">...</div>

<!-- Manual: must be closed explicitly -->
<div popover="manual">...</div>

<!-- Hint: for tooltips, auto-closes -->
<div popover="hint">...</div>
```

### Popover CSS

```css
[popover] {
  /* Default styles when hidden */
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 150ms, transform 150ms, display 150ms allow-discrete;
}

[popover]:popover-open {
  opacity: 1;
  transform: translateY(0);
}

/* Backdrop */
[popover]::backdrop {
  background: rgba(0, 0, 0, 0.3);
}

/* Starting style for enter transition */
@starting-style {
  [popover]:popover-open {
    opacity: 0;
    transform: translateY(-8px);
  }
}
```

## Dialog Enhancements

```html
<!-- Modal with light dismiss -->
<dialog closedby="any">
  <form method="dialog">
    <button>Close</button>
  </form>
</dialog>
```

```css
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}
```

## Invoker Commands

Declarative element interactions without JavaScript.

```html
<!-- Open/close popover -->
<button popovertarget="popover" popovertargetaction="toggle">
  Toggle
</button>

<!-- Open dialog -->
<button commandfor="dialog" command="showModal">
  Open Modal
</button>

<!-- Custom commands -->
<button commandfor="video" command="play">Play</button>
<button commandfor="video" command="pause">Pause</button>
```

## Details/Summary Improvements

```css
/* Style the marker */
summary::marker {
  content: ">> ";
}

details[open] summary::marker {
  content: "v ";
}

/* Animate open/close */
details {
  transition: height 200ms;
}
```

## Interest Invokers (Tooltips)

```html
<button interesttarget="tooltip">Hover me</button>
<div id="tooltip" popover="hint">Tooltip content</div>
```
