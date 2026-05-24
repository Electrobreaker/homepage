import {
  prepareWithSegments,
  layoutNextLine
} from 'https://esm.sh/@chenglou/pretext'

initEmailCopy()
initRunawayLocation()

function initEmailCopy() {
  const emailChip = document.querySelector('.email-copy-chip')

  if (!emailChip) return

  const status = emailChip.querySelector('.email-copy-chip__status')
  const email = emailChip.dataset.email || ''

  const setEmailState = (state, text) => {
    emailChip.classList.remove('is-copied', 'is-error')

    if (state) {
      emailChip.classList.add(state)
    }

    if (status) {
      status.textContent = text
    }
  }

  const fallbackCopy = text => {
    const textarea = document.createElement('textarea')

    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'absolute'
    textarea.style.left = '-9999px'

    document.body.appendChild(textarea)
    textarea.select()

    const successful = document.execCommand('copy')

    document.body.removeChild(textarea)

    return successful
  }

  emailChip.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(email)
      } else {
        const copied = fallbackCopy(email)

        if (!copied) {
          throw new Error('Copy failed')
        }
      }

      setEmailState('is-copied', 'Copied')
      emailChip.setAttribute('aria-label', 'Email copied')

      setTimeout(() => {
        setEmailState(null, 'Copy')
        emailChip.setAttribute('aria-label', 'Copy email address')
      }, 1800)
    } catch (error) {
      setEmailState('is-error', 'Error')
      emailChip.setAttribute('aria-label', 'Could not copy email')

      setTimeout(() => {
        setEmailState(null, 'Copy')
        emailChip.setAttribute('aria-label', 'Copy email address')
      }, 1800)
    }
  })
}

function initRunawayLocation() {
  const locationChip = document.querySelector('[data-runaway-location]')
  const flow = document.querySelector('[data-pretext-flow]')
  const movementSection = locationChip?.closest('.resume__section--hero')

  if (!locationChip || !flow || !movementSection) return

  const source = flow.querySelector('.pretext-flow__source')
  const linesLayer = flow.querySelector('.pretext-flow__lines')

  if (!source || !linesLayer) return

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches

  if (prefersReducedMotion) return

  const text = source.textContent.replace(/\s+/g, ' ').trim()

  let chipX = 0
  let chipY = 0

  let initialChipX = 0
  let initialChipY = 0

  let velocityX = 0
  let velocityY = 0

  let pointerX = null
  let pointerY = null

  let preparedText = null
  let font = ''
  let lineHeight = 24
  let chipPlaceholder = null

  let lastInteractionAt = performance.now()
  let isReturningHome = false

  const activationDistance = 95
  const escapePower = 1.1
  const friction = 0.84
  const maxSpeed = 7
  const edgePadding = 18

  const returnDelay = 1500
  const returnStrength = 0.035
  const returnStopDistance = 0.8

  const clamp = (value, min, max) => {
    return Math.min(max, Math.max(min, value))
  }

  const getFontForCanvas = element => {
    const styles = getComputedStyle(element)

    return [
      styles.fontStyle,
      styles.fontVariant,
      styles.fontWeight,
      styles.fontSize,
      styles.fontFamily
    ].join(' ')
  }

  const updateChipTransform = () => {
    locationChip.style.transform = `translate3d(${chipX}px, ${chipY}px, 0)`
  }

  const setupChipPosition = () => {
    const chipRect = locationChip.getBoundingClientRect()
    const sectionRect = movementSection.getBoundingClientRect()

    chipX = chipRect.left - sectionRect.left
    chipY = chipRect.top - sectionRect.top

    initialChipX = chipX
    initialChipY = chipY

    velocityX = 0
    velocityY = 0
    isReturningHome = false
    lastInteractionAt = performance.now()

    locationChip.style.width = `${chipRect.width}px`
    locationChip.style.height = `${chipRect.height}px`

    if (!chipPlaceholder) {
      chipPlaceholder = document.createElement('div')
      chipPlaceholder.className = 'contact-chip-placeholder'
      locationChip.parentNode.insertBefore(chipPlaceholder, locationChip)
    }

    chipPlaceholder.style.width = `${chipRect.width}px`
    chipPlaceholder.style.height = `${chipRect.height}px`

    locationChip.classList.add('is-floating')
    updateChipTransform()
  }

  const updateTextSettings = () => {
    const styles = getComputedStyle(source)

    font = getFontForCanvas(source)
    lineHeight = parseFloat(styles.lineHeight)

    if (!Number.isFinite(lineHeight)) {
      lineHeight = parseFloat(styles.fontSize) * 1.6
    }

    preparedText = prepareWithSegments(text, font)
  }

  const getChipObstacleForFlow = () => {
    const chipRect = locationChip.getBoundingClientRect()
    const flowRect = flow.getBoundingClientRect()

    return {
      left: chipRect.left - flowRect.left,
      right: chipRect.right - flowRect.left,
      top: chipRect.top - flowRect.top,
      bottom: chipRect.bottom - flowRect.top
    }
  }

  const getAvailableSlots = ({ y, width, obstacle }) => {
    const chipPaddingX = 14
    const chipPaddingY = 8
    const minSlotWidth = 72

    const bandTop = y
    const bandBottom = y + lineHeight

    const paddedObstacle = {
      left: obstacle.left - chipPaddingX,
      right: obstacle.right + chipPaddingX,
      top: obstacle.top - chipPaddingY,
      bottom: obstacle.bottom + chipPaddingY
    }

    const isOverlapping =
      paddedObstacle.bottom > bandTop && paddedObstacle.top < bandBottom

    if (!isOverlapping) {
      return [
        {
          left: 0,
          right: width
        }
      ]
    }

    const slots = [
      {
        left: 0,
        right: clamp(paddedObstacle.left, 0, width)
      },
      {
        left: clamp(paddedObstacle.right, 0, width),
        right: width
      }
    ]

    return slots
      .filter(slot => slot.right - slot.left >= minSlotWidth)
      .sort((a, b) => a.left - b.left)
  }

  const renderFlow = () => {
    if (!preparedText) return

    const flowWidth = flow.clientWidth

    if (flowWidth <= 0) return

    const obstacle = getChipObstacleForFlow()

    let cursor = {
      segmentIndex: 0,
      graphemeIndex: 0
    }

    let y = 0
    let isDone = false

    const lines = []
    const maxRows = 80

    for (let row = 0; row < maxRows && !isDone; row += 1) {
      const slots = getAvailableSlots({
        y,
        width: flowWidth,
        obstacle
      })

      if (slots.length === 0) {
        y += lineHeight
        continue
      }

      for (const slot of slots) {
        const slotWidth = slot.right - slot.left
        const line = layoutNextLine(preparedText, cursor, slotWidth)

        if (!line) {
          isDone = true
          break
        }

        lines.push({
          text: line.text,
          x: slot.left,
          y
        })

        cursor = line.end
      }

      y += lineHeight
    }

    const fragment = document.createDocumentFragment()

    for (const line of lines) {
      const span = document.createElement('span')

      span.className = 'pretext-flow__line'
      span.textContent = line.text
      span.style.transform = `translate3d(${line.x}px, ${line.y}px, 0)`
      span.style.lineHeight = `${lineHeight}px`

      fragment.appendChild(span)
    }

    linesLayer.replaceChildren(fragment)

    const height = Math.max(y, lineHeight)

    linesLayer.style.height = `${height}px`
    flow.style.minHeight = `${height}px`
    flow.classList.add('is-ready')
  }

  const getChipCenter = () => {
    const sectionRect = movementSection.getBoundingClientRect()

    return {
      x: sectionRect.left + chipX + locationChip.offsetWidth / 2,
      y: sectionRect.top + chipY + locationChip.offsetHeight / 2
    }
  }

  const getMovementBounds = () => {
    const chipWidth = locationChip.offsetWidth
    const chipHeight = locationChip.offsetHeight

    const minX = edgePadding
    const maxX = movementSection.offsetWidth - chipWidth - edgePadding

    const minY = initialChipY
    const maxY = movementSection.offsetHeight - chipHeight - edgePadding

    return {
      minX,
      maxX: Math.max(minX, maxX),
      minY,
      maxY: Math.max(minY, maxY)
    }
  }

  const applyMovementBounds = () => {
    const bounds = getMovementBounds()

    const wasOutsideLeft = chipX < bounds.minX
    const wasOutsideRight = chipX > bounds.maxX
    const wasOutsideTop = chipY < bounds.minY
    const wasOutsideBottom = chipY > bounds.maxY

    chipX = clamp(chipX, bounds.minX, bounds.maxX)
    chipY = clamp(chipY, bounds.minY, bounds.maxY)

    if (isReturningHome) {
      if (wasOutsideLeft || wasOutsideRight) {
        velocityX *= 0.2
      }

      if (wasOutsideTop || wasOutsideBottom) {
        velocityY *= 0.2
      }

      return
    }

    if (wasOutsideLeft || wasOutsideRight) {
      velocityX *= -0.35
    }

    if (wasOutsideTop) {
      velocityY = Math.max(0, velocityY)
    }

    if (wasOutsideBottom) {
      velocityY *= -0.35
    }
  }

  const applyPointerForce = now => {
    if (pointerX === null || pointerY === null) {
      locationChip.classList.remove('is-running')
      return false
    }

    const chipCenter = getChipCenter()

    const distanceX = chipCenter.x - pointerX
    const distanceY = chipCenter.y - pointerY
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2)

    if (distance >= activationDistance) {
      locationChip.classList.remove('is-running')
      return false
    }

    const force = 1 - distance / activationDistance
    const angle = Math.atan2(distanceY, distanceX)

    velocityX += Math.cos(angle) * force * escapePower
    velocityY += Math.sin(angle) * force * escapePower

    lastInteractionAt = now
    isReturningHome = false

    locationChip.classList.add('is-running')

    return true
  }

  const applyReturnHome = now => {
    const shouldReturnHome = now - lastInteractionAt > returnDelay

    if (shouldReturnHome) {
      isReturningHome = true
    }

    if (!isReturningHome) return

    const returnX = initialChipX - chipX
    const returnY = initialChipY - chipY

    velocityX += returnX * returnStrength
    velocityY += returnY * returnStrength

    locationChip.classList.remove('is-running')

    const distanceToHome = Math.sqrt(returnX ** 2 + returnY ** 2)
    const currentReturnSpeed = Math.sqrt(velocityX ** 2 + velocityY ** 2)

    if (distanceToHome < returnStopDistance && currentReturnSpeed < 0.45) {
      chipX = initialChipX
      chipY = initialChipY
      velocityX = 0
      velocityY = 0
      isReturningHome = false
      lastInteractionAt = now
    }
  }

  const limitSpeed = () => {
    const currentSpeed = Math.sqrt(velocityX ** 2 + velocityY ** 2)

    if (currentSpeed <= maxSpeed) return

    velocityX = (velocityX / currentSpeed) * maxSpeed
    velocityY = (velocityY / currentSpeed) * maxSpeed
  }

  const updatePhysics = () => {
    const now = performance.now()

    applyPointerForce(now)
    applyReturnHome(now)

    velocityX *= friction
    velocityY *= friction

    limitSpeed()

    chipX += velocityX
    chipY += velocityY

    applyMovementBounds()
    updateChipTransform()
    renderFlow()

    requestAnimationFrame(updatePhysics)
  }

  const handleResize = () => {
    locationChip.classList.remove('is-floating')
    locationChip.style.transform = ''
    locationChip.style.width = ''
    locationChip.style.height = ''

    if (chipPlaceholder) {
      chipPlaceholder.remove()
      chipPlaceholder = null
    }

    setupChipPosition()
    updateTextSettings()
    renderFlow()
  }

  document.addEventListener('pointermove', event => {
    pointerX = event.clientX
    pointerY = event.clientY
  })

  document.addEventListener('pointerleave', () => {
    pointerX = null
    pointerY = null
    locationChip.classList.remove('is-running')
  })

  window.addEventListener('resize', handleResize)

  setupChipPosition()
  updateTextSettings()
  renderFlow()

  requestAnimationFrame(updatePhysics)
}