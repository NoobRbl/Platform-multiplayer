const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 576;

const gravity = 0.6;
let globalTime = 0; // Dùng để animate (thở, chạy)

// --- SYSTEM: PARTICLES & EFFECTS ---
let particles = [];
let projectiles = [];
let screenShake = 0;

function createParticle(x, y, color, speed, size = 3, life = 20) {
    particles.push({ x, y, color, velocity: speed, size, life, alpha: 1 });
}

function createExplosion(x, y, color, count = 10) {
    for(let i=0; i<count; i++) {
        const speed = { x: (Math.random()-0.5)*10, y: (Math.random()-0.5)*10 };
        createParticle(x, y, color, speed, Math.random()*4 + 2);
    }
}

// --- CLASS: STICKMAN FIGHTER ---
class Fighter {
    constructor({ position, velocity, color, name, isPlayer = false }) {
        this.position = position;
        this.velocity = velocity;
        this.width = 40; 
        this.height = 100; // Hitbox height
        
        // Stats
        this.color = color;
        this.name = name;
        this.health = 100;
        this.percent = 0;
        this.meter = 0; // Ultimate meter (0-100)
        
        // Physics
        this.isGrounded = false;
        this.jumps = 2;
        this.facingRight = true;
        
        // States
        this.isAttacking = false;
        this.isShielding = false;
        this.isDashing = false;
        this.isUlt = false; // Ultimate Mode
        
        // Cooldowns
        this.cdSkill1 = 0;
        this.cdSkill2 = 0;
        
        // Hitbox
        this.attackBox = { position: {x:0, y:0}, width: 80, height: 50, offset: {x:0, y:0} };
        
        this.isPlayer = isPlayer;
    }

    draw() {
        // --- DRAW STICKMAN (PROCEDURAL ANIMATION) ---
        c.save();
        c.translate(this.position.x + this.width/2, this.position.y);
        
        // Flip nếu quay trái
        if (!this.facingRight) c.scale(-1, 1);

        // Màu sắc (Nếu đang ULT thì đổi màu cầu vồng)
        let drawColor = this.color;
        if (this.isUlt) drawColor = `hsl(${globalTime * 10}, 100%, 50%)`;
        c.strokeStyle = drawColor;
        c.fillStyle = drawColor;
        c.lineWidth = 4;
        c.lineCap = 'round';
        c.lineJoin = 'round';

        // 1. Calculate Animation Angles
        let bodyY = -40; // Vị trí cổ
        let headY = -55;
        let kneeL = 0, kneeR = 0, footL = 0, footR = 0;
        let elbowL = 0, elbowR = 0, handL = 0, handR = 0;

        // ANIMATION: IDLE (Thở)
        if (this.isGrounded && Math.abs(this.velocity.x) < 0.5 && !this.isAttacking) {
            bodyY += Math.sin(globalTime * 0.1) * 2; // Nhấp nhô
            headY += Math.sin(globalTime * 0.1) * 2;
            // Tay đung đưa nhẹ
            elbowR = Math.sin(globalTime * 0.1) * 0.2;
            elbowL = -Math.sin(globalTime * 0.1) * 0.2;
        }

        // ANIMATION: RUN (Chân xoay vòng)
        if (this.isGrounded && Math.abs(this.velocity.x) > 0.5) {
            const runSpeed = 0.3;
            const legAmp = 20;
            footL = Math.sin(globalTime * runSpeed) * legAmp;
            footR = Math.sin(globalTime * runSpeed + Math.PI) * legAmp;
            // Body nghiêng tới trước
            c.rotate(0.2); 
        }

        // ANIMATION: JUMP (Co chân)
        if (!this.isGrounded) {
            footL = -15; footR = -10;
            elbowL = -1; elbowR = 1;
        }

        // ANIMATION: ATTACK (Tay vung mạnh)
        let armAttackOffset = 0;
        if (this.isAttacking) {
            armAttackOffset = 40; // Vươn tay ra
            c.rotate(0.1); // Người lao tới
        }

        // --- VẼ XƯƠNG ---
        
        // HEAD
        c.beginPath();
        c.arc(0, headY, 12, 0, Math.PI * 2);
        c.fill();

        // BODY
        c.beginPath();
        c.moveTo(0, headY + 5);
        c.lineTo(0, 0); // Hông
        c.stroke();

        // LEGS (Hip -> Foot)
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(-10 + footL, 35); // Chân trái
        c.moveTo(0, 0);
        c.lineTo(10 + footR, 35); // Chân phải
        c.stroke();

        // ARMS (Shoulder -> Hand)
        c.beginPath();
        c.moveTo(0, bodyY + 10); // Vai
        // Tay sau (Trái)
        c.lineTo(-15, bodyY + 30); 
        // Tay trước (Phải - Tay cầm vũ khí/đấm)
        c.moveTo(0, bodyY + 10);
        c.lineTo(25 + armAttackOffset, bodyY + 25); 
        c.stroke();

        // WEAPON / EFFECT (Nếu đang đánh)
        if (this.isAttacking) {
            c.fillStyle = 'white';
            c.beginPath();
            // Vẽ vệt chém (Swipe)
            c.arc(30, bodyY + 25, 40, -0.5, 1.5);
            c.lineTo(30, bodyY + 25);
            c.globalAlpha = 0.5;
            c.fill();
            c.globalAlpha = 1.0;
        }

        // SHIELD VISUAL
        if (this.isShielding) {
            c.strokeStyle = '#3742fa';
            c.lineWidth = 2;
            c.beginPath();
            c.arc(0, -10, 50, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = 'rgba(55, 66, 250, 0.2)';
            c.fill();
        }

        c.restore();

        // Draw Debug Box (Optional - tắt đi cho đẹp)
        // c.strokeStyle = 'rgba(255,255,255,0.2)';
        // c.strokeRect(this.position.x, this.position.y, this.width, this.height);
    }

    update() {
        this.draw();
        
        // Update Attack Box Position
        this.attackBox.position.x = this.position.x + (this.facingRight ? 0 : -this.attackBox.width + 40);
        this.attackBox.position.y = this.position.y + 10;

        // Physics
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Gravity
        if (this.position.y + this.height + this.velocity.y >= canvas.height - 50) {
            this.velocity.y = 0;
            this.position.y = canvas.height - 50 - this.height;
            this.isGrounded = true;
            this.jumps = 2;
        } else {
            this.velocity.y += gravity;
            this.isGrounded = false;
        }

        // Friction
        if (this.isGrounded) this.velocity.x *= 0.8;
        else this.velocity.x *= 0.95;

        // Meter regen passive
        if (this.meter < 100) this.meter += 0.05;

        // Cooldown tick
        if (this.cdSkill1 > 0) this.cdSkill1--;
        if (this.cdSkill2 > 0) this.cdSkill2--;

        // Cập nhật UI
        if(this.isPlayer) {
            document.getElementById('p1-meter').style.width = this.meter + '%';
        }
    }

    // --- ACTIONS ---
    attack() {
        if (this.isAttacking || this.isShielding) return;
        this.isAttacking = true;
        setTimeout(() => this.isAttacking = false, 200); // 0.2s attack
        // Sound effect placeholder
    }

    skill1() { // J - SHOOT PROJECTILE
        if (this.cdSkill1 > 0 || this.isShielding) return;
        this.cdSkill1 = 100; // Cooldown
        
        const dir = this.facingRight ? 1 : -1;
        projectiles.push({
            x: this.position.x + 20,
            y: this.position.y + 30,
            vx: 15 * dir,
            vy: 0,
            owner: this,
            color: this.color,
            life: 60
        });
        
        // Recoil
        this.velocity.x = -5 * dir;
    }

    skill2() { // K - DASH ATTACK (Lướt chém)
        if (this.cdSkill2 > 0 || this.isShielding) return;
        this.cdSkill2 = 150;
        
        const dir = this.facingRight ? 1 : -1;
        this.velocity.x = 25 * dir; // Lướt cực nhanh
        this.velocity.y = 0;
        this.attack(); // Kèm theo hit
        
        // Trail Effect
        for(let i=0; i<5; i++) createParticle(this.position.x, this.position.y, this.color, {x:0, y:0}, 5);
    }

    ultimate() { // L - OVERDRIVE
        if (this.meter >= 100) {
            this.meter = 0;
            this.isUlt = true;
            screenShake = 20;
            createExplosion(this.position.x, this.position.y, this.color, 50);
            
            // Buff speed
            setTimeout(() => {
                this.isUlt = false;
            }, 5000); // 5s bá đạo
        }
    }

    shield() { // S - Block
        this.isShielding = true;
        this.velocity.x = 0;
    }

    dash() { // Shift
        if (this.isDashing) return;
        this.isDashing = true;
        const dir = this.facingRight ? 1 : -1;
        this.velocity.x = 15 * dir;
        setTimeout(() => this.isDashing = false, 200);
    }

    takeHit(damage, knockbackX, knockbackY) {
        if (this.isShielding) {
            damage *= 0.1; // Giảm 90% dmg
            knockbackX *= 0.2;
            this.meter += 5; // Block được hồi mana
            createParticle(this.position.x, this.position.y, 'white', {x:0,y:0}, 2);
            return;
        }

        this.percent += damage;
        this.health -= damage * 0.5; // HP giảm chậm hơn percent
        
        // Update UI
        if(this.isPlayer) {
            document.getElementById('p1-percent').innerText = Math.floor(this.percent) + '%';
            document.getElementById('p1-health').style.width = this.health + '%';
        } else {
            document.getElementById('p2-percent').innerText = Math.floor(this.percent) + '%';
            document.getElementById('p2-health').style.width = this.health + '%';
        }

        // Apply Knockback (Smash Formula simplified)
        let flyForce = (this.percent / 10) + 2;
        this.velocity.x = (knockbackX > 0 ? 1 : -1) * flyForce * 1.5;
        this.velocity.y = -flyForce;

        screenShake = 5 + (this.percent/20);
        createExplosion(this.position.x, this.position.y, 'white', 5);
        
        // Hitstop
        // (Đã có logic hitstop ở loop chính, ở đây chỉ tính toán số liệu)
    }
}

// --- SETUP ---
const p1 = new Fighter({
    position: { x: 100, y: 100 },
    velocity: { x: 0, y: 0 },
    color: '#00ffcc',
    name: "ZEPHYR",
    isPlayer: true
});

const p2 = new Fighter({
    position: { x: 800, y: 100 },
    velocity: { x: 0, y: 0 },
    color: '#ff4757',
    name: "GOLIATH"
});

const keys = {
    a: { pressed: false },
    d: { pressed: false },
    w: { pressed: false },
    s: { pressed: false }
};

// --- MAIN LOOP ---
function animate() {
    window.requestAnimationFrame(animate);
    globalTime++;

    // Shake Camera
    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
        shakeX = (Math.random()-0.5) * screenShake;
        shakeY = (Math.random()-0.5) * screenShake;
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    c.save();
    c.translate(shakeX, shakeY);

    // BG Clear with Trail
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.fillRect(0, 0, canvas.width, canvas.height);

    // Floor
    c.shadowBlur = 20;
    c.shadowColor = '#00ffcc';
    c.strokeStyle = '#00ffcc';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, canvas.height - 50);
    c.lineTo(canvas.width, canvas.height - 50);
    c.stroke();
    c.shadowBlur = 0;

    // PROJECTILES
    projectiles.forEach((proj, index) => {
        proj.x += proj.vx;
        proj.life--;
        
        // Draw Projectile
        c.fillStyle = proj.color;
        c.beginPath();
        c.arc(proj.x, proj.y, 10, 0, Math.PI*2);
        c.fill();
        
        // Collision with Enemy (Giả sử P1 bắn P2)
        let target = proj.owner === p1 ? p2 : p1;
        if (proj.x > target.position.x && proj.x < target.position.x + target.width &&
            proj.y > target.position.y && proj.y < target.position.y + target.height) {
                target.takeHit(8, proj.vx, -5);
                projectiles.splice(index, 1);
        }

        if (proj.life <= 0) projectiles.splice(index, 1);
    });

    // PARTICLES
    particles.forEach((p, index) => {
        p.x += p.velocity.x;
        p.y += p.velocity.y;
        p.alpha -= 0.05;
        if(p.alpha <= 0) particles.splice(index, 1);
        else {
            c.fillStyle = p.color;
            c.globalAlpha = p.alpha;
            c.fillRect(p.x, p.y, p.size, p.size);
            c.globalAlpha = 1;
        }
    });

    // UPDATE PLAYERS
    p1.update();
    p2.update();

    // P1 MOVEMENT
    p1.velocity.x = 0;
    let speed = p1.isUlt ? 12 : 6; // Ult chạy nhanh gấp đôi

    if (keys.a.pressed) {
        p1.velocity.x = -speed;
        p1.facingRight = false;
    } else if (keys.d.pressed) {
        p1.velocity.x = speed;
        p1.facingRight = true;
    }

    // HIT DETECTION (Melee)
    if (p1.isAttacking && 
        p1.attackBox.position.x + p1.attackBox.width >= p2.position.x &&
        p1.attackBox.position.x <= p2.position.x + p2.width &&
        p1.attackBox.position.y + p1.attackBox.height >= p2.position.y &&
        p1.attackBox.position.y <= p2.position.y + p2.height
    ) {
        p1.isAttacking = false; // Reset để không hit nhiều lần 1 chiêu
        let knockDir = p1.position.x < p2.position.x ? 1 : -1;
        p2.takeHit(5, knockDir * 10, -5);
        p1.meter += 10; // Đánh trúng hồi mana
    }

    // --- SIMPLE AI FOR P2 ---
    // P2 tries to follow P1
    if (p2.position.x < p1.position.x - 100) {
        p2.velocity.x = 3;
        p2.facingRight = true;
    } else if (p2.position.x > p1.position.x + 100) {
        p2.velocity.x = -3;
        p2.facingRight = false;
    } else {
        p2.velocity.x = 0;
        // Nếu gần thì đánh ngẫu nhiên
        if (Math.random() < 0.02) p2.attack();
    }
    // Check if P2 hits P1
    if (p2.isAttacking && 
        p2.attackBox.position.x + p2.attackBox.width >= p1.position.x &&
        p2.attackBox.position.x <= p1.position.x + p1.width
    ) {
        p2.isAttacking = false;
        let knockDir = p2.position.x < p1.position.x ? 1 : -1;
        p1.takeHit(8, knockDir * 15, -5); // Goliath đánh đau hơn
    }

    c.restore();
}

animate();

// --- CONTROLS MAPPING ---
// Support cả PC (Keyboard) và Mobile (Touch) map vào cùng functions

function jump(p) { if(p.jumps > 0) { p.velocity.y = -12; p.jumps--; } }

window.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'd': keys.d.pressed = true; break;
        case 'a': keys.a.pressed = true; break;
        case 'w': jump(p1); break;
        case ' ': p1.attack(); break;
        case 's': p1.shield(); break;
        case 'shift': p1.dash(); break;
        case 'j': p1.skill1(); break;
        case 'k': p1.skill2(); break;
        case 'l': p1.ultimate(); break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'd': keys.d.pressed = false; break;
        case 'a': keys.a.pressed = false; break;
        case 's': p1.isShielding = false; break;
    }
});

// MOBILE TOUCH BINDING
const btnMap = {
    'btn-jump': () => jump(p1),
    'btn-attack': () => p1.attack(),
    'btn-shield': () => p1.shield(),
    'btn-s1': () => p1.skill1(),
    'btn-s2': () => p1.skill2(),
    'btn-ult': () => p1.ultimate()
};

Object.keys(btnMap).forEach(id => {
    const btn = document.getElementById(id);
    if(btn) {
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); btnMap[id](); });
        if(id === 'btn-shield') { // Shield cần giữ
            btn.addEventListener('touchend', (e) => { e.preventDefault(); p1.isShielding = false; });
        }
    }
});

// JOYSTICK (Đã có logic từ version trước, giữ nguyên logic update keys)
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
let touchId = null;

joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchId = e.changedTouches[0].identifier;
    updateJoystick(e.changedTouches[0]);
});

joystickBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if(touchId !== null) updateJoystick(e.changedTouches[0]);
});

joystickBase.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchId = null;
    joystickStick.style.transform = `translate(-50%, -50%)`;
    keys.a.pressed = false; keys.d.pressed = false;
});

function updateJoystick(touch) {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width/2;
    const dx = touch.clientX - centerX;
    const limit = 40;
    
    // Move stick visual
    const moveX = Math.max(-limit, Math.min(limit, dx));
    joystickStick.style.transform = `translate(calc(-50% + ${moveX}px), -50%)`;

    if (moveX > 10) { keys.d.pressed = true; keys.a.pressed = false; }
    else if (moveX < -10) { keys.a.pressed = true; keys.d.pressed = false; }
    else { keys.d.pressed = false; keys.a.pressed = false; }
}
