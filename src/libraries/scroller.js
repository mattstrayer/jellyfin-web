import browser from 'browser';
import layoutManager from 'layoutManager';
import dom from 'dom';
import focusManager from 'focusManager';
import ResizeObserver from 'ResizeObserver';
import 'scrollStyles';

/**
* Return type of the value.
*
* @param  {Mixed} value
*
* @return {String}
*/
function type(value) {
    if (value == null) {
        return String(value);
    }

    if (typeof value === 'object' || typeof value === 'function') {
        return Object.prototype.toString.call(value).match(/\s([a-z]+)/i)[1].toLowerCase() || 'object';
    }

    return typeof value;
}

/**
 * Disables an event it was triggered on and unbinds itself.
 *
 * @param  {Event} event
 *
 * @return {Void}
 */
function disableOneEvent(event) {
    /*jshint validthis:true */
    event.preventDefault();
    event.stopPropagation();
    this.removeEventListener(event.type, disableOneEvent);
}

/**
 * Make sure that number is within the limits.
 *
 * @param {Number} number
 * @param {Number} min
 * @param {Number} max
 *
 * @return {Number}
 */
function within(number, min, max) {
    return number < min ? min : number > max ? max : number;
}

// Other global values
var dragMouseEvents = ['mousemove', 'mouseup'];
var dragTouchEvents = ['touchmove', 'touchend'];
var wheelEvent = (document.implementation.hasFeature('Event.wheel', '3.0') ? 'wheel' : 'mousewheel');
var interactiveElements = ['INPUT', 'SELECT', 'TEXTAREA'];

// Math shorthands
var abs = Math.abs;
var sqrt = Math.sqrt;
var pow = Math.pow;
var round = Math.round;
var max = Math.max;
var min = Math.min;


class Scroller {
  
    constructor(frame, options) {
        this.frame = frame;
        var o = Object.assign({}, {
            slidee: null, // Selector, DOM element, or jQuery object with DOM element representing SLIDEE.
            horizontal: false, // Switch to horizontal mode.
    
            // Scrolling
            mouseWheel: true,
            scrollBy: 0, // Pixels or items to move per one mouse scroll. 0 to disable scrolling
    
            // Dragging
            dragSource: null, // Selector or DOM element for catching dragging events. Default is FRAME.
            mouseDragging: 1, // Enable navigation by dragging the SLIDEE with mouse cursor.
            touchDragging: 1, // Enable navigation by dragging the SLIDEE with touch events.
            dragThreshold: 3, // Distance in pixels before Sly recognizes dragging.
            intervactive: null, // Selector for special interactive elements.
    
            // Mixed options
            speed: 0 // Animations speed in milliseconds. 0 to disable animations.
    
        }, options);
        this.isSmoothScrollSupported = 'scrollBehavior' in document.documentElement.style;

        // native scroll is a must with touch input
        // also use native scroll when scrolling vertically in desktop mode - excluding horizontal because the mouse wheel support is choppy at the moment
        // in cases with firefox, if the smooth scroll api is supported then use that because their implementation is very good
        if (o.allowNativeScroll === false) {
            o.enableNativeScroll = false;
        } else if (this.isSmoothScrollSupported && ((browser.firefox && !layoutManager.tv) || o.allowNativeSmoothScroll)) {
            // native smooth scroll
            o.enableNativeScroll = true;
        } else if (o.requireAnimation && (browser.animate || browser.supportsCssAnimation())) {

            // transform is the only way to guarantee animation
            o.enableNativeScroll = false;
        } else if (!layoutManager.tv || !browser.animate) {

            o.enableNativeScroll = true;
        }
        // Need this for the magic wheel. With the animated scroll the magic wheel will run off of the screen
        if (browser.web0s) {
            o.enableNativeScroll = true;
        }

        this.options = o;

        // Frame
        this.slideeElement = this.optionsslidee ? this.optionsslidee : sibling(this.frame.firstChild)[0];
        this._pos = {
            start: 0,
            center: 0,
            end: 0,
            cur: 0,
            dest: 0
        };

        this.transform = !this.options.enableNativeScroll;

        // Miscellaneous
        this.scrollSource = frame;
        this.dragSourceElement = this.options.dragSource ? this.options.dragSource : frame;
        this.dragging = {
            released: 1
        };
        this.scrolling = {
            last: 0,
            delta: 0,
            resetTime: 200
        };

        // Expose properties
        this.initialized = 0;
        this.slidee = slideeElement;
        this.dragging = dragging;

        this.nativeScrollElement = frame;

        this.lastAnimate;
        this.contentRect = {};

        this.requiresReflow = true;
    }

    sibling(n, elem) {
        var matched = [];

        for (; n; n = n.nextSibling) {
            if (n.nodeType === 1 && n !== elem) {
                matched.push(n);
            }
        }
        return matched;
    }

    ensureSizeInfo() {

        if (this.requiresReflow) {

            this.requiresReflow = false;

            // Reset global variables
            this.frameSize = this.options.horizontal ? (frame).offsetWidth : (frame).offsetHeight;

            this.slideeSize = this.options.scrollWidth || Math.max(this.slideeElement[this.options.horizontal ? 'offsetWidth' : 'offsetHeight'], this.slideeElement[this.options.horizontal ? 'scrollWidth' : 'scrollHeight']);

            // Set position limits & relativess
            this._pos.end = max(this.slideeSize - this.frameSize, 0);
        }
    }
    /**
     * Loading function.
     *
     * Populate arrays, set sizes, bind events, ...
     *
     * @param {Boolean} [isInit] Whether load is called from within self.init().
     * @return {Void}
     */
    load(isInit) {

        this.requiresReflow = true;

        if (!isInit) {

            this.ensureSizeInfo();

            // Fix possible overflowing
            var pos = self._pos;
            this.slideTo(within(pos.dest, pos.start, pos.end));
        }
    }
    initFrameResizeObserver() {

        var observerOptions = {};

        self.frameResizeObserver = new ResizeObserver(onResize, observerOptions);

        self.frameResizeObserver.observe(frame);
    }
    reload() {
        this.load()
    }
    getScrollEventName() {
        return this.transform ? 'scrollanimate' : 'scroll';
    };

    getScrollSlider(){
        return this.slideeElement;
    };

    getScrollFrame() {
        return this.frame;
    };
    nativeScrollTo(container, pos, immediate) {

        if (container.scroll) {
            if (this.options.horizontal) {

                container.scroll({
                    left: pos,
                    behavior: immediate ? 'instant' : 'smooth'
                });
            } else {

                container.scroll({
                    top: pos,
                    behavior: immediate ? 'instant' : 'smooth'
                });
            }
        } else if (!immediate && container.scrollTo) {
            if (this.options.horizontal) {
                container.scrollTo(Math.round(pos), 0);
            } else {
                container.scrollTo(0, Math.round(pos));
            }
        } else {
            if (this.options.horizontal) {
                container.scrollLeft = Math.round(pos);
            } else {
                container.scrollTop = Math.round(pos);
            }
        }
    }
    /**
     * Animate to a position.
     *
     * @param {Int}  newPos    New position.
     * @param {Bool} immediate Reposition immediately without an animation.
     *
     * @return {Void}
     */
    slideTo (newPos, immediate, fullItemPos) {

        this.ensureSizeInfo();
        var pos = this._pos;

        newPos = within(newPos, pos.start, pos.end);

        if (!this.transform) {

            this.nativeScrollTo(this.nativeScrollElement, newPos, immediate);
            return;
        }

        // Update the animation object
        var from = pos.cur;
        immediate = immediate || dragging.init || !this.options.speed;

        var now = new Date().getTime();

        if (this.options.autoImmediate) {
            if (!immediate && (now - (lastAnimate || 0)) <= 50) {
                immediate = true;
            }
        }

        if (!immediate && this.options.skipSlideToWhenVisible && fullItemPos && fullItemPos.isVisible) {

            return;
        }

        // Start animation rendering
        // NOTE the dependency was modified here to fix a scrollbutton issue
        pos.dest = newPos;
        this.renderAnimateWithTransform(from, newPos, immediate);
        this.lastAnimate = now;
    };
    setStyleProperty(elem, name, value, speed, resetTransition) {

        var style = elem.style;

        if (resetTransition || browser.edge) {
            style.transition = 'none';
            void elem.offsetWidth;
        }

        style.transition = 'transform ' + speed + 'ms ease-out';
        style[name] = value;
    }
    dispatchScrollEventIfNeeded() {
        if (this.options.dispatchScrollEvent) {
            this.frame.dispatchEvent(new CustomEvent(this.getScrollEventName(), {
                bubbles: true,
                cancelable: false
            }));
        }
    }
    renderAnimateWithTransform(fromPosition, toPosition, immediate) {

        var speed = this.options.speed;

        if (immediate) {
            speed = this.options.immediateSpeed || 50;
        }

        if (this.options.horizontal) {
            this.setStyleProperty(this.slideeElement, 'transform', 'translateX(' + (-round(toPosition)) + 'px)', speed);
        } else {
            this.setStyleProperty(this.slideeElement, 'transform', 'translateY(' + (-round(toPosition)) + 'px)', speed);
        }
        this._pos.cur = toPosition;

        this.dispatchScrollEventIfNeeded();
    }
    getBoundingClientRect(elem) {

        // Support: BlackBerry 5, iOS 3 (original iPhone)
        // If we don't have gBCR, just use 0,0 rather than error
        if (elem.getBoundingClientRect) {
            return elem.getBoundingClientRect();
        } else {
            return { top: 0, left: 0 };
        }
    }
    /**
     * Returns the position object.
     *
     * @param {Mixed} item
     *
     * @return {Object}
     */
    getPos(item) {

        var scrollElement = transform ? slideeElement : nativeScrollElement;
        var slideeOffset = this.getBoundingClientRect(scrollElement);
        var itemOffset = this.getBoundingClientRect(item);

        var slideeStartPos = this.options.horizontal ? slideeOffset.left : slideeOffset.top;
        var slideeEndPos = this.options.horizontal ? slideeOffset.right : slideeOffset.bottom;

        var offset = this.options.horizontal ? itemOffset.left - slideeOffset.left : itemOffset.top - slideeOffset.top;

        var size = this.options.horizontal ? itemOffset.width : itemOffset.height;
        if (!size && size !== 0) {
            size = item[this.options.horizontal ? 'offsetWidth' : 'offsetHeight'];
        }

        var centerOffset = this.options.centerOffset || 0;

        if (!this.transform) {
            centerOffset = 0;
            if (this.options.horizontal) {
                offset += nativeScrollElement.scrollLeft;
            } else {
                offset += nativeScrollElement.scrollTop;
            }
        }

        this.ensureSizeInfo();

        var currentStart = this._pos.cur;
        var currentEnd = currentStart + this.frameSize;

        console.debug('offset:' + offset + ' currentStart:' + currentStart + ' currentEnd:' + currentEnd);
        var isVisible = offset >= currentStart && (offset + size) <= currentEnd;

        return {
            start: offset,
            center: offset + centerOffset - (this.frameSize / 2) + (size / 2),
            end: offset - this.frameSize + size,
            size: size,
            isVisible: isVisible
        };
    };
    getCenterPosition = function (item) {

        this.ensureSizeInfo();

        var pos = this.getPos(item);
        return within(pos.center, pos.start, pos.end);
    };
    dragInitSlidee(event) {
        var isTouch = event.type === 'touchstart';

        // Ignore when already in progress, or interactive element in non-touch navivagion
        if (dragging.init || !isTouch && this.isInteractive(event.target)) {
            return;
        }

        // SLIDEE dragging conditions
        if (!(isTouch ? this.options.touchDragging : this.options.mouseDragging && event.which < 2)) {
            return;
        }

        if (!isTouch) {
            // prevents native image dragging in Firefox
            event.preventDefault();
        }

        // Reset dragging object
        dragging.released = 0;

        // Properties used in dragHandler
        dragging.init = 0;
        dragging.source = event.target;
        dragging.touch = isTouch;
        var pointer = isTouch ? event.touches[0] : event;
        dragging.initX = pointer.pageX;
        dragging.initY = pointer.pageY;
        dragging.initPos = self._pos.cur;
        dragging.start = +new Date();
        dragging.time = 0;
        dragging.path = 0;
        dragging.delta = 0;
        dragging.locked = 0;
        dragging.pathToLock = isTouch ? 30 : 10;

        // Bind dragging events
        if (this.transform) {

            if (isTouch) {
                dragTouchEvents.forEach(function (eventName) {
                    dom.addEventListener(document, eventName, dragHandler, {
                        passive: true
                    });
                });
            } else {
                dragMouseEvents.forEach(function (eventName) {
                    dom.addEventListener(document, eventName, dragHandler, {
                        passive: true
                    });
                });
            }
        }
    }
    /**
     * Handler for dragging scrollbar handle or SLIDEE.
     *
     * @param  {Event} event
     *
     * @return {Void}
     */
    dragHandler(event) {
        dragging.released = event.type === 'mouseup' || event.type === 'touchend';
        var pointer = dragging.touch ? event[dragging.released ? 'changedTouches' : 'touches'][0] : event;
        dragging.pathX = pointer.pageX - dragging.initX;
        dragging.pathY = pointer.pageY - dragging.initY;
        dragging.path = sqrt(pow(dragging.pathX, 2) + pow(dragging.pathY, 2));
        dragging.delta = this.options.horizontal ? dragging.pathX : dragging.pathY;

        if (!dragging.released && dragging.path < 1) {
            return;
        }

        // We haven't decided whether this is a drag or not...
        if (!dragging.init) {
            // If the drag path was very short, maybe it's not a drag?
            if (dragging.path < this.options.dragThreshold) {
                // If the pointer was released, the path will not become longer and it's
                // definitely not a drag. If not released yet, decide on next iteration
                return dragging.released ? this.dragEnd() : undefined;
            } else {
                // If dragging path is sufficiently long we can confidently start a drag
                // if drag is in different direction than scroll, ignore it
                if (this.options.horizontal ? abs(dragging.pathX) > abs(dragging.pathY) : abs(dragging.pathX) < abs(dragging.pathY)) {
                    dragging.init = 1;
                } else {
                    return this.dragEnd();
                }
            }
        }

        //event.preventDefault();

        // Disable click on a source element, as it is unwelcome when dragging
        if (!dragging.locked && dragging.path > dragging.pathToLock) {
            dragging.locked = 1;
            dragging.source.addEventListener('click', disableOneEvent);
        }

        // Cancel dragging on release
        if (dragging.released) {
            this.dragEnd();
        }

        this.slideTo(round(dragging.initPos - dragging.delta));
    }
    /**
     * Stops dragging and cleans up after it.
     *
     * @return {Void}
     */
    dragEnd() {
        dragging.released = true;

        dragTouchEvents.forEach(function (eventName) {
            dom.removeEventListener(document, eventName, dragHandler, {
                passive: true
            });
        });

        dragMouseEvents.forEach(function (eventName) {
            dom.removeEventListener(document, eventName, dragHandler, {
                passive: true
            });
        });

        // Make sure that disableOneEvent is not active in next tick.
        setTimeout(function () {
            dragging.source.removeEventListener('click', disableOneEvent);
        });

        dragging.init = 0;
    }
     /**
     * Check whether element is interactive.
     *
     * @return {Boolean}
     */
    isInteractive(element) {

        while (element) {

            if (interactiveElements.indexOf(element.tagName) !== -1) {
                return true;
            }

            element = element.parentNode;
        }
        return false;
    }
    /**
     * Mouse wheel delta normalization.
     *
     * @param  {Event} event
     *
     * @return {Int}
     */
    normalizeWheelDelta(event) {
        // JELLYFIN MOD: Only use deltaX for horizontal scroll and remove IE8 support
        scrolling.curDelta = this.options.horizontal ? event.deltaX : event.deltaY;
        // END JELLYFIN MOD

        if (this.transform) {
            scrolling.curDelta /= event.deltaMode === 1 ? 3 : 100;
        }
        return scrolling.curDelta;
    }
    /**
     * Mouse scrolling handler.
     *
     * @param  {Event} event
     *
     * @return {Void}
     */
    scrollHandler(event) {

        this.ensureSizeInfo();
        var pos = this._pos;
        // Ignore if there is no scrolling to be done
        if (!this.options.scrollBy || pos.start === pos.end) {
            return;
        }
        var delta = this.normalizeWheelDelta(event);

        if (this.transform) {
            // Trap scrolling only when necessary and/or requested
            if (delta > 0 && pos.dest < pos.end || delta < 0 && pos.dest > pos.start) {
                //stopDefault(event, 1);
            }

            this.slideBy(this.options.scrollBy * delta);
        } else {

            if (isSmoothScrollSupported) {
                delta *= 12;
            }

            if (this.options.horizontal) {
                this.nativeScrollElement.scrollLeft += delta;
            } else {
                this.nativeScrollElement.scrollTop += delta;
            }
        }
    }
    /**
     * Destroys instance and everything it created.
     *
     * @return {Void}
     */
    destroy() {

        if (this.frameResizeObserver) {
            this.frameResizeObserver.disconnect();
            this.frameResizeObserver = null;
        }

        // Reset native FRAME element scroll
        dom.removeEventListener(this.frame, 'scroll', this.resetScroll, {
            passive: true
        });

        dom.removeEventListener(this.scrollSource, wheelEvent, this.scrollHandler, {
            passive: true
        });

        dom.removeEventListener(this.dragSourceElement, 'touchstart', this.dragInitSlidee, {
            passive: true
        });

        dom.removeEventListener(this.frame, 'click', this.onFrameClick, {
            passive: true,
            capture: true
        });

        dom.removeEventListener(dragSourceElement, 'mousedown', this.dragInitSlidee, {
            //passive: true
        });

        // Reset initialized status and return the instance
        this.initialized = 0;
        return this;
    };


    onResize(entries) {

        var entry = entries[0];

        if (entry) {

            var newRect = entry.contentRect;

            // handle element being hidden
            if (newRect.width === 0 || newRect.height === 0) {
                return;
            }

            if (newRect.width !== contentRect.width || newRect.height !== contentRect.height) {

                this.contentRect = newRect;

                this.load(false);
            }
        }
    }
    resetScroll() {
        if (this.options.horizontal) {
            this.scrollLeft = 0;
        } else {
            this.scrollTop = 0;
        }
    }
    onFrameClick(e) {
        if (e.which === 1) {
            console.log(focusManager)
            console.log(focusManager)
            var focusableParent = focusManager.focusableParent(e.target);
            if (focusableParent && focusableParent !== document.activeElement) {
                focusableParent.focus();
            }
        }
    }
    getScrollPosition = function () {

        if (this.transform) {
            return this._pos.cur;
        }

        if (this.options.horizontal) {
            return this.nativeScrollElement.scrollLeft;
        } else {
            return this.nativeScrollElement.scrollTop;
        }
    };
    getScrollSize = function () {

        if (this.transform) {
            return this.slideeSize;
        }

        if (this.options.horizontal) {
            return this.nativeScrollElement.scrollWidth;
        } else {
            return this.nativeScrollElement.scrollHeight;
        }
    };
    /**
     * Initialize.
     *
     * @return {Object}
     */
    init() {
        if (this.initialized) {
            return;
        }

        if (!this.transform) {
            if (this.options.horizontal) {
                if (layoutManager.desktop && !this.options.hideScrollbar) {
                    this.nativeScrollElement.classList.add('scrollX');
                } else {
                    this.nativeScrollElement.classList.add('scrollX');
                    this.nativeScrollElement.classList.add('hiddenScrollX');

                    if (layoutManager.tv && this.options.allowNativeSmoothScroll !== false) {
                        this.nativeScrollElement.classList.add('smoothScrollX');
                    }
                }

                if (this.options.forceHideScrollbars) {
                    this.nativeScrollElement.classList.add('hiddenScrollX-forced');
                }
            } else {
                if (layoutManager.desktop && !this.options.hideScrollbar) {
                    this.nativeScrollElement.classList.add('scrollY');
                } else {
                    this.nativeScrollElement.classList.add('scrollY');
                    this.nativeScrollElement.classList.add('hiddenScrollY');

                    if (layoutManager.tv && this.options.allowNativeSmoothScroll !== false) {
                        this.nativeScrollElement.classList.add('smoothScrollY');
                    }
                }

                if (this.options.forceHideScrollbars) {
                    this.nativeScrollElement.classList.add('hiddenScrollY-forced');
                }
            }
        } else {
            this.frame.style.overflow = 'hidden';
            this.slideeElement.style['will-change'] = 'transform';
            this.slideeElement.style.transition = 'transform ' + this.options.speed + 'ms ease-out';

            if (this.options.horizontal) {
                this.slideeElement.classList.add('animatedScrollX');
            } else {
                this.slideeElement.classList.add('animatedScrollY');
            }
        }

        if (this.transform || layoutManager.tv) {
            // This can prevent others from being able to listen to mouse events
            dom.addEventListener(this.dragSourceElement, 'mousedown', this.dragInitSlidee, {
                //passive: true
            });
        }

        this.initFrameResizeObserver();

        if (this.transform) {

            dom.addEventListener(this.dragSourceElement, 'touchstart', this.dragInitSlidee, {
                passive: true
            });

            if (!this.options.horizontal) {
                dom.addEventListener(this.frame, 'scroll', this.resetScroll, {
                    passive: true
                });
            }

            if (this.options.mouseWheel) {
                // Scrolling navigation
                dom.addEventListener(this.scrollSource, wheelEvent, this.scrollHandler, {
                    passive: true
                });
            }

        } else if (this.options.horizontal) {

            // Don't bind to mouse events with vertical scroll since the mouse wheel can handle this natively

            if (this.options.mouseWheel) {
                // Scrolling navigation
                dom.addEventListener(this.scrollSource, wheelEvent, this.scrollHandler, {
                    passive: true
                });
            }
        }

        dom.addEventListener(this.frame, 'click', this.onFrameClick, {
            passive: true,
            capture: true
        });

        // Mark instance as initialized
        this.initialized = 1;

        // Load
        this.load(true);

        // Return instance
        return this;
    };


    // prototypes

    /**
     * Slide SLIDEE by amount of pixels.
     *
     * @param {Int}  delta     Pixels/Items. Positive means forward, negative means backward.
     * @param {Bool} immediate Reposition immediately without an animation.
     *
     * @return {Void}
     */
    slideBy(delta, immediate) {
        if (!delta) {
            return;
        }
        this.slideTo(this._pos.dest + delta, immediate);
    };

    /**
     * Core method for handling `toLocation` methods.
     *
     * @param  {String} location
     * @param  {Mixed}  item
     * @param  {Bool}   immediate
     *
     * @return {Void}
     */
    to(location, item, immediate) {
        // Optional arguments logic
        if (type(item) === 'boolean') {
            immediate = item;
            item = undefined;
        }

        if (item === undefined) {
            this.slideTo(this._pos[location], immediate);
        } else {
            var itemPos = this.getPos(item);

            if (itemPos) {
                this.slideTo(itemPos[location], immediate, itemPos);
            }
        }
    };

    /**
     * Animate element or the whole SLIDEE to the start of the frame.
     *
     * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
     * @param {Bool}  immediate Reposition immediately without an animation.
     *
     * @return {Void}
     */
    toStart(item, immediate) {
        this.to('start', item, immediate);
    };

     /**
     * Animate element or the whole SLIDEE to the end of the frame.
     *
     * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
     * @param {Bool}  immediate Reposition immediately without an animation.
     *
     * @return {Void}
     */
    toEnd(item, immediate) {
        this.to('end', item, immediate);
    };

    /**
     * Animate element or the whole SLIDEE to the center of the frame.
     *
     * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
     * @param {Bool}  immediate Reposition immediately without an animation.
     *
     * @return {Void}
     */
    toCenter(item, immediate) {
        this.to('center', item, immediate);
    };
    // create(frame, options) {
    //     var instance = new scrollerFactory(frame, options);
    //     return Promise.resolve(instance);
    // };
}

export default Scroller;