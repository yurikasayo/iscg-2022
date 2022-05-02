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
const controlPointsMaterial = new THREE.PointsMaterial({ size: 8, color: 0xee0000 })
const controlLineMaterial = new THREE.LineBasicMaterial({ color: 0xee0000 })
const curvePointsMaterial = new THREE.PointsMaterial({ size: 4, color: 0x00ee00 })
const curveLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ee00 })

/**
 * Mode
 */
debugObject.mode = 'bezier'
const changeMode = () =>
{
    switch (debugObject.mode)
    {
        case 'bezier':
            bezier.visible = true
            spline.visible = false
            bezierGui.children.map(child => child.enable())
            splineGui.children.map(child => child.disable())
            break

        case 'spline':
            bezier.visible = false
            spline.visible = true
            bezierGui.children.map(child => child.disable())
            splineGui.children.map(child => child.enable())
            break
    }
}
gui.add(debugObject, 'mode').options(['bezier', 'spline']).name('mode').onChange(changeMode)

/**
 * Rational Bezier Curve
 */
// group
const bezier = new THREE.Group()
scene.add(bezier)

// bezier parameters
const bezierObject = {}
bezierObject.interval = 0.05
bezierObject.w0 = 1
bezierObject.w1 = 1
bezierObject.w2 = 1
bezierObject.showControlLine = true

// gui
const bezierGui = gui.addFolder('Bezier')

// control vertices
const bezierControlVertices = []
bezierControlGeometry = new THREE.BufferGeometry()

bezierControlVertices.push(new THREE.Vector3(- 100, 0, 0))
bezierControlVertices.push(new THREE.Vector3(0, 100, 0))
bezierControlVertices.push(new THREE.Vector3(100, 0, 0))
bezierControlGeometry.setFromPoints(bezierControlVertices)

// bezier vertices
let bezierVertices = []
const bezierGeometry = new THREE.BufferGeometry()
const updateBezier = () =>
{
    bezierVertices = []
    for (let t = 0; t < 1; t += bezierObject.interval)
    {
        let xi0 = bezierObject.w0 * (1-t) * (1-t)
        let xi1 = bezierObject.w1 * 2 * t * (1-t)
        let xi2 = bezierObject.w2 * t * t

        const sum = xi0 + xi1 + xi2
        xi0 /= sum
        xi1 /= sum
        xi2 /= sum

        const vertice = new THREE.Vector3()
        vertice.addScaledVector(bezierControlVertices[0], xi0)
        vertice.addScaledVector(bezierControlVertices[1], xi1)
        vertice.addScaledVector(bezierControlVertices[2], xi2)
        bezierVertices.push(vertice)
    }
    bezierVertices.push(bezierControlVertices[2])
    bezierGeometry.setFromPoints(bezierVertices)
}
updateBezier()

bezierGui.add(bezierObject, 'w0').min(-1).max(5).step(0.01).name('w0').onChange(updateBezier)
bezierGui.add(bezierObject, 'w1').min(-1).max(5).step(0.01).name('w1').onChange(updateBezier)
bezierGui.add(bezierObject, 'w2').min(-1).max(5).step(0.01).name('w2').onChange(updateBezier)
bezierGui.add(bezierObject, 'interval').min(0.01).max(0.2).step(0.01).name('interval').onChange(updateBezier)

// draw
const bezierControlPoints = new THREE.Points(bezierControlGeometry, controlPointsMaterial)
bezierControlPoints.position.z = 10
bezier.add(bezierControlPoints)
const bezierControlLine = new THREE.Line(bezierControlGeometry, controlLineMaterial)
bezierControlLine.position.z = 10
bezier.add(bezierControlLine)

const bezierPoints = new THREE.Points(bezierGeometry, curvePointsMaterial)
bezier.add(bezierPoints)
const bezierLine = new THREE.Line(bezierGeometry, curveLineMaterial)
bezier.add(bezierLine)

bezierGui.add(bezierObject, 'showControlLine').name('showControlLine').onChange((value) => bezierControlLine.visible = value)

/**
 * Catmull-Rom Spline Curve
 */
// group
const spline = new THREE.Group()
scene.add(spline)

// parameters
const splineObject = {}
splineObject.parameterization = 'uniform'
splineObject.pointNum = 5
splineObject.interval = 0.05
splineObject.showControlLine = true

// gui
const splineGui = gui.addFolder('Spline')

// control vertices
const splineControlVertices = []
splineControlGeometry = new THREE.BufferGeometry()
for (let i = 0; i < splineObject.pointNum; i++) {
    splineControlVertices.push(new THREE.Vector3(Math.random() * 400 - 200, Math.random() * 400 - 200, 0))
}
splineControlGeometry.setFromPoints(splineControlVertices)

// bezier vertices
let splineVertices = []
const splineGeometry = new THREE.BufferGeometry()
const updateSpline = () =>
{
    tk = []
    tk.push(-1)
    tk.push(0)
    for (let i = 1; i < splineControlVertices.length; i++) {
        switch (splineObject.parameterization) {
            case 'uniform':
                tk.push(tk[i]+1)
                break

            case 'chordal':
                tk.push(tk[i]+splineControlVertices[i].distanceTo(splineControlVertices[i-1]))
                break

            case 'centripetal':
                tk.push(tk[i]+Math.sqrt(splineControlVertices[i].distanceTo(splineControlVertices[i-1])))
                break
        }
    }
    tk.push(tk[tk.length-1]+1)

    splineVertices = []
    let id = 1
    for (let t = 0; t < tk[tk.length-2]; t += splineObject.interval * tk[tk.length-2]/(tk.length-2))
    {
        if (t >= tk[id+1]) id++ 

        const A1 = new THREE.Vector3()
        A1.addScaledVector(splineControlVertices[Math.max(0,id-2)], 1-(t-tk[id-1])/(tk[id]-tk[id-1]))
        A1.addScaledVector(splineControlVertices[id-1], (t-tk[id-1])/(tk[id]-tk[id-1]))
        const A2 = new THREE.Vector3()
        A2.addScaledVector(splineControlVertices[id-1], 1-(t-tk[id])/(tk[id+1]-tk[id]))
        A2.addScaledVector(splineControlVertices[id], (t-tk[id])/(tk[id+1]-tk[id]))
        const A3 = new THREE.Vector3()
        A3.addScaledVector(splineControlVertices[id], 1-(t-tk[id+1])/(tk[id+2]-tk[id+1]))
        A3.addScaledVector(splineControlVertices[Math.min(splineControlVertices.length-1,id+1)], (t-tk[id+1])/(tk[id+2]-tk[id+1]))

        const B1 = new THREE.Vector3()
        B1.addScaledVector(A1, 1-(t-tk[id-1])/(tk[id+1]-tk[id-1]))
        B1.addScaledVector(A2, (t-tk[id-1])/(tk[id+1]-tk[id-1]))
        const B2 = new THREE.Vector3()
        B2.addScaledVector(A2, 1-(t-tk[id])/(tk[id+2]-tk[id]))
        B2.addScaledVector(A3, (t-tk[id])/(tk[id+2]-tk[id]))

        const vertice = new THREE.Vector3()
        vertice.addScaledVector(B1, 1-(t-tk[id])/(tk[id+1]-tk[id]))
        vertice.addScaledVector(B2, (t-tk[id])/(tk[id+1]-tk[id]))
        splineVertices.push(vertice)
    }
    splineVertices.push(splineControlVertices[splineControlVertices.length-1])
    splineGeometry.setFromPoints(splineVertices)
}
updateSpline()

splineGui.add(splineObject, 'parameterization').options(['uniform', 'chordal', 'centripetal']).name('parameterization').onChange(updateSpline)
splineGui.add(splineObject, 'pointNum').min(4).max(10).step(1).name('pointNum').onChange(() =>
{
    if (splineObject.pointNum < splineControlVertices.length)
    {
        splineControlVertices.pop()
    }
    else if (splineObject.pointNum > splineControlVertices.length)
    {
        splineControlVertices.push(new THREE.Vector3(Math.random() * 400 - 200, Math.random() * 400 - 200, 0))
    }
    splineControlGeometry.setFromPoints(splineControlVertices)
    updateSpline()
})
splineGui.add(splineObject, 'interval').min(0.01).max(0.2).step(0.01).name('interval').onChange(updateSpline)

// draw
const splineControlPoints = new THREE.Points(splineControlGeometry, controlPointsMaterial)
splineControlPoints.position.z = 10
spline.add(splineControlPoints)
const splineControlLine = new THREE.Line(splineControlGeometry, controlLineMaterial)
splineControlLine.position.z = 10
spline.add(splineControlLine)

const splinePoints = new THREE.Points(splineGeometry, curvePointsMaterial)
spline.add(splinePoints)
const splineLine = new THREE.Line(splineGeometry, curveLineMaterial)
spline.add(splineLine)

splineGui.add(splineObject, 'showControlLine').name('showControlLine').onChange((value) => splineControlLine.visible = value)


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
        switch (debugObject.mode) 
        {
            case 'bezier':
                bezierControlVertices[target].copy(mousePosition)
                bezierControlGeometry.setFromPoints(bezierControlVertices)
                updateBezier()
                break

            case 'spline':
                splineControlVertices[target].copy(mousePosition)
                splineControlGeometry.setFromPoints(splineControlVertices)
                updateSpline()
                break
        }
    }
    else
    {
        target = -1
        switch (debugObject.mode) 
        {
            case 'bezier':
                for (let i = 0; i < bezierControlVertices.length; i++)
                {
                    if (bezierControlVertices[i].distanceTo(mousePosition) < 10)
                        target = i
                }
                break

            case 'spline':
                for (let i = 0; i < splineControlVertices.length; i++)
                {
                    if (splineControlVertices[i].distanceTo(mousePosition) < 10)
                        target = i
                }
                break
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

changeMode()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()