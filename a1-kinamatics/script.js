/**
 * GUI
 */
const GUI = lil.GUI
const gui = new GUI()
const debugObject = {}

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Grid
 */
const gridHelper = new THREE.GridHelper(2000, 40, 0x666666, 0xcccccc)
gridHelper.rotation.x=Math.PI/2;
gridHelper.position.z=-10;
scene.add(gridHelper)

/**
 * Material
 */
const objectPointMaterial = new THREE.PointsMaterial({ size: 12, color: 0x00ee00 })
const bonePointsMaterial = new THREE.PointsMaterial({ size: 8, color: 0xee0000 })
const boneLineMaterial = new THREE.LineBasicMaterial({ color: 0xee0000 })

/**
 * Object Point
 */
const objectGeometry = new THREE.BufferGeometry()
const objectVertice = [new THREE.Vector3(200,0,0)]
objectGeometry.setFromPoints(objectVertice)

/**
 * Bone
 */
// control vertices
let boneVertices = []
boneGeometry = new THREE.BufferGeometry()

boneVertices.push(new THREE.Vector3(-200, 0, 0))
boneVertices.push(new THREE.Vector3(-100, 100, 0))
boneVertices.push(new THREE.Vector3(0, 0, 0))
boneVertices.push(new THREE.Vector3(100, 100, 0))
boneGeometry.setFromPoints(boneVertices)

// draw
const objectPoint = new THREE.Points(objectGeometry, objectPointMaterial)
objectPoint.position.z = 10
scene.add(objectPoint)

const bonePoints = new THREE.Points(boneGeometry, bonePointsMaterial)
bonePoints.position.z = 10
scene.add(bonePoints)
const boneLine = new THREE.Line(boneGeometry, boneLineMaterial)
boneLine.position.z = 10
scene.add(boneLine)

// change length
debugObject.boneLength = 4
const updateLength = () =>
{
    isCalculating = false
    if (debugObject.boneLength > boneVertices.length)
    {
        boneVertices.push(new THREE.Vector3(Math.random() * 400 - 200, Math.random() * 400 - 200, 0))
    }
    else if (debugObject.boneLength < boneVertices.length)
    {
        boneVertices = boneVertices.slice(0,debugObject.boneLength)
    }
    boneGeometry.setFromPoints(boneVertices)
}
gui.add(debugObject, "boneLength").min(3).max(10).step(1).onChange(updateLength)

/**
 * MouseEvent
 */
let target = -1
let dragging = false
const mousePosition = new THREE.Vector3()

document.addEventListener('mousemove', (event) => {
    mousePosition.x = event.clientX - sizes.width / 2
    mousePosition.y = - event.clientY + sizes.height / 2
 
    if (dragging)
    {
        isCalculating = false
        if (target == 100)
        {
            objectVertice[0].copy(mousePosition)
            objectGeometry.setFromPoints(objectVertice)
        }
        else
        {
            boneVertices[target].copy(mousePosition)
            boneGeometry.setFromPoints(boneVertices)
        }
    }
    else
    {
        target = -1
        if (objectVertice[0].distanceTo(mousePosition) < 10)
            target = 100
        for (let i = 0; i < boneVertices.length; i++)
        {
            if (boneVertices[i].distanceTo(mousePosition) < 10)
                target = i
        }

        if (target != -1)
            canvas.style.cursor = 'grab'
        else
            canvas.style.cursor = 'auto'
    }
})

document.addEventListener('mousedown', () => {
    if (target != -1) dragging = true
})

document.addEventListener('mouseup', () => {
    dragging = false
})


/**
 * Calculating
 */
// paremeters
let isCalculating = false
let calculatedId = 1
let steps = 0

// gui
debugObject.startCalculation = () => 
{
    isCalculating = true
    calculatedId = 1
    steps = 0
}
gui.add(debugObject, "startCalculation")

// process
const calculateAngles = () =>
{
    const calculatedVertice = boneVertices[boneVertices.length-(calculatedId+1)]
    const toEnd = boneVertices[boneVertices.length-1].clone()
    toEnd.sub(calculatedVertice)
    const currentAngle = Math.atan2(toEnd.y,toEnd.x)

    const toObject = objectVertice[0].clone()
    toObject.sub(calculatedVertice)
    let desiredAngle = Math.atan2(toObject.y,toObject.x)

    if (desiredAngle - currentAngle > Math.PI)
        desiredAngle -= 2 * Math.PI
    else if (desiredAngle - currentAngle < -Math.PI)
        desiredAngle += 2 * Math.PI

    if (Math.abs(desiredAngle - currentAngle) < 0.001)
    {
        calculatedId++
        if (calculatedId == boneVertices.length)
        {
            calculatedId = 1
            steps++
            if (steps > 50)
                isCalculating = false
        }
    }
    else
    {
        const rotateAngle = (desiredAngle - currentAngle) * 0.1
        for (let i = 0; i < calculatedId; i++) {
            const tmpVertice = boneVertices[boneVertices.length-(i+1)].sub(calculatedVertice)
            tmpVertice.applyAxisAngle(new THREE.Vector3(0,0,1), rotateAngle)
            tmpVertice.add(calculatedVertice)
            boneVertices[boneVertices.length-(i+1)] = tmpVertice
        }
    }
    boneGeometry.setFromPoints(boneVertices)

    if (objectVertice[0].distanceTo(boneVertices[boneVertices.length-1]) < 0.1) 
        isCalculating = false
}


/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => 
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.left = - sizes.width / 2
    camera.right = sizes.width / 2
    camera.top = sizes.height / 2
    camera.bottom = - sizes.height / 2
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.OrthographicCamera(- sizes.width / 2, sizes.width / 2, sizes.height / 2, - sizes.height / 2, 1, 1000)
camera.position.z = 100
scene.add(camera)

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0xeeeeee)

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    if (isCalculating) calculateAngles()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()