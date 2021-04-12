let camera, scene, renderer;
let geometry, material, mesh;
let clock;

//Particles
let systems, bufferData;
let msToSec = 1/1000;
let particle_system = {
    "num_systems": 1,
    "system_0": {
        "id": 1,
        "src_bfact": 770,
        "dst_bfact": 1,
        "origin": "Mesh",
        "position": [
            0,
            0,
            0
        ],
        "spawn_mode": "Linear",
        "max_particles": 100,
        "spawn_rate": 10,
        "particles_per_wave": 10,
        "particle_data": {
            "max_speed": [
                "0",
                "0",
                "0"
            ],
            "min_speed": [
                "0",
                "0",
                "0"
            ],
            "max_size": 0.25,
            "min_size": 0.1,
            "max_life_time": 10,
            "min_life_time": 5,
            "color": [
                1,
                1,
                1,
                1
            ]
        },
        "atlasName": "None",
        "uvs": [],
        "texture": {
            "id": -1,
            "prop": {
                "subtextures": false,
                "textures_x": 1,
                "textures_y": 1,
                "animated": false,
                "anim_loop": false,
                "anim_duration": 0
            }
        },
        "origin_mesh": {
            "name": "4_pango.obj",
            "modal": [
                0.02500000037252903,
                0,
                0,
                0,
                0,
                0.02500000037252903,
                0,
                0,
                0,
                0,
                0.02500000037252903,
                0,
                2,
                0,
                0,
                1
            ],
            "triangle_num": 5968,
            "div_value": 9
        },
        "sub_emittors": [],
        "forces": [],
        "modifications": []
    }
};

//Shaders
let vertexShader, flatFragment, textFragment;

init();

function init() {

    clock = new THREE.Clock();
    clock.start();

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 1000 );
    camera.position.z = 10;

    scene = new THREE.Scene();

    geometry = new THREE.BoxGeometry( 1, 1, 1 );
    material = new THREE.MeshNormalMaterial();

    mesh = new THREE.Mesh( geometry, material );
    mesh.position.z = 2;
    scene.add( mesh );

    //Load the shaders
    vertexShader = document.getElementById( 'vertexShader' ).textContent;
    flatFragment = document.getElementById( 'flatFragmentShader' ).textContent;
    textFragment = document.getElementById( 'texturedFragmentShader' ).textContent;

    systems = new Dixie(particle_system, createParticleMesh, loadTexture, loadMesh, "Graph");

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( animation );
    document.body.appendChild( renderer.domElement );
}

function animation( time ) {

    mesh.rotation.x = time / 2000;
    mesh.rotation.y = time / 1000;

    let c_pos = camera.position;
    
    let eye = [0,0,0];
    eye[0] = c_pos.x;
    eye[1] = c_pos.y;
    eye[2] = c_pos.z;

    systems.update( clock.getDelta(), eye, getBufferData, uploadBuffers);

    //Update the uniforms for the particles
    let graphs = systems.graphs;
    let graph, render_info, uniforms;
    
    //Get the right vector of the camera
    let right = new THREE.Vector3();
    let mv = camera.modelViewMatrix.elements;
    right.x = mv[0];
    right.y = mv[4];
    right.z = mv[8];

    //Get the up vector of the camera
    let up = camera.up;

    //In a same frame this uniforms will be the same for all graphs
    right = { value : right};
    up  = { value : camera.up};

    for (let i = 0; i < graphs.length; ++i) 
    {
        graph = graphs[i];
        render_info = graph.renderInfo;

        //Update the uniforms
        uniforms = graph.particle_mesh.material.uniforms; 
        uniforms.u_right = right;
        uniforms.u_up = up; 
    }

    renderer.render( scene, camera );   
}

function getBufferData( mesh ) {
    let attributes = mesh.geometry.attributes;

    let buffers = {};
    let keys = Object.keys(attributes), key;

    for (let i = 0; i < keys.length; ++i)
    {
        key = keys[i];
        
        if(key == "icoord") continue;

        buffers[key] = attributes[key].array;
    }

    return buffers;
}

function uploadBuffers( mesh, buffers ) {
    let attributes = mesh.geometry.attributes;
    let keys = Object.keys(attributes), key;

    for (let i = 0; i < keys.length; ++i)
    {
        key = keys[i];

        if(key == "icoord") continue;

        attributes[key].array = buffers[key];
        attributes[key].needsUpdate = true;
    }
}

function loadTexture( atlasURL, toSave, graph) {
    let loader = new THREE.TextureLoader();

    loader.load( atlasURL,
        function ( texture ) {
            graph[toSave] = texture;

            let material = graph.particle_mesh.material; 
            material.uniforms.u_texture = {value : texture};
            material.fragmentShader = textFragment;
            material.needsUpdate = true;
        }
    );
}

function loadMesh( meshURL, toSaveMesh, toSaveVertices, graph ) {
    let loader = new THREE.OBJLoader();

    loader.load( meshURL,
        function ( object ) {
            //Update the modal
            object.modelViewMatrix.elements = graph.origin_mesh.modal;
            //Save the mesh in the graph
            graph[toSaveMesh] = object;
            //Save the vertices
            graph[toSaveVertices] = object.geometry.attributes.position.array; 
        }
    );
}

function createParticleMesh( buffers, graph ) {
    //Geometry creation
    let geometry = new THREE.BufferGeometry();

    //Attributes of the geometry
    let data, buffer;

    for(let i = 0; i < buffers.length; ++i)
    {
        buffer = buffers[i];
        data   = Float32Array.from(buffer.data);
        geometry.setAttribute( buffer.name, new THREE.BufferAttribute( data, buffer.elems ));
        
        if(buffer.name == "vertices")
            geometry.setAttribute( 'position', new THREE.BufferAttribute( data, buffer.elems ) );
    }

    //Shader material
    let s_material = new THREE.ShaderMaterial( {

        uniforms: {
            u_right : { value : camera.up},
            u_up : { value : camera.up}
        },

        vertexShader: vertexShader,
        fragmentShader:flatFragment
    } );

    //Disable cull face
    s_material.side = THREE.DoubleSide;

    //Set the blending
    s_material.blending = THREE.CustomBlending;
    s_material.blendEquation = THREE.AddEquation;
    s_material.blendSrc = THREE.SrcAlphaFactor;
    s_material.blendDst = THREE.OneMinusSrcAlphaFactor;

    //Disable the depth test and depth mask
    s_material.depthTest  = true;
    s_material.depthWrite = false;

    //Compute the bounding box (OPTIONAL)
    geometry.computeBoundingBox();

    let p_mesh = new THREE.Mesh( geometry, s_material );
    scene.add( p_mesh );

    return p_mesh;
}