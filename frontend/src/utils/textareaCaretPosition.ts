/**
 * textarea-caret-position
 * Adapted from: https://github.com/component/textarea-caret-position
 * 
 * Get pixel coordinates of the caret in a textarea or input.
 */

const properties = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'MozTabSize'
];

const isBrowser = typeof window !== 'undefined';
const isFirefox = isBrowser && (window as any).mozInnerScreenX != null;

export interface CaretCoordinates {
    top: number;
    left: number;
    height: number;
}

export function getCaretCoordinates(element: HTMLTextAreaElement | HTMLInputElement, position: number): CaretCoordinates {
    if (!isBrowser) {
        throw new Error('getCaretCoordinates should only be called in a browser');
    }

    const div = document.createElement('div');
    div.id = 'textarea-caret-position-mirror-div';
    document.body.appendChild(div);

    const style = div.style;
    const computed = window.getComputedStyle(element);
    const isInput = element.nodeName === 'INPUT';

    // Default textarea styles
    style.whiteSpace = 'pre-wrap';
    if (!isInput) {
        style.wordWrap = 'break-word';
    }

    // Position off-screen
    style.position = 'absolute';
    style.visibility = 'hidden';

    // Transfer the element's properties to the div
    properties.forEach((prop) => {
        if (isInput && prop === 'lineHeight') {
            if (computed.boxSizing === 'border-box') {
                const height = parseInt(computed.height);
                const outerHeight =
                    parseInt(computed.paddingTop) +
                    parseInt(computed.paddingBottom) +
                    parseInt(computed.borderTopWidth) +
                    parseInt(computed.borderBottomWidth);
                const targetHeight = outerHeight + parseInt(computed.lineHeight);
                if (height > targetHeight) {
                    style.lineHeight = height - outerHeight + 'px';
                } else if (height === targetHeight) {
                    style.lineHeight = computed.lineHeight;
                } else {
                    style.lineHeight = '0';
                }
            } else {
                style.lineHeight = computed.height;
            }
        } else {
            (style as any)[prop] = (computed as any)[prop];
        }
    });

    if (isFirefox) {
        if (element.scrollHeight > parseInt(computed.height)) {
            style.overflowY = 'scroll';
        }
    } else {
        style.overflow = 'hidden';
    }

    div.textContent = element.value.substring(0, position);
    if (isInput) {
        div.textContent = div.textContent.replace(/\s/g, '\u00a0');
    }

    const span = document.createElement('span');
    // CRITICAL: Copy the rest of the text content to ensure wrapping is identical
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    const coordinates: CaretCoordinates = {
        top: span.offsetTop + parseInt(computed.borderTopWidth),
        left: span.offsetLeft + parseInt(computed.borderLeftWidth),
        height: parseInt(computed.lineHeight)
    };

    document.body.removeChild(div);

    return coordinates;
}

/**
 * Convert line/column to absolute position
 */
export function lineColumnToPosition(content: string, line: number, column: number): number {
    const lines = content.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
        pos += lines[i].length + 1; // +1 for newline
    }
    pos += Math.min(column, (lines[line - 1] || '').length);
    return pos;
}
