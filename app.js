// Data structures
let mealPlan = {};
let ingredientDirectory = [];
let recipeLibrary = [];
let currentWeekStart = new Date();
let planDuration = 1; // 1 or 2 weeks
let currentEditingSlot = null;

// Unit conversion factors (to base unit - grams for weight, milliliters for volume)
const unitConversions = {
    // Weight
    'gram': 1,
    'kilogram': 1000,
    'milligram': 0.001,
    'ounce': 28.3495,
    'pound': 453.592,
    
    // Volume
    'milliliter': 1,
    'liter': 1000,
    'cup': 236.588,
    'tablespoon': 14.7868,
    'teaspoon': 4.92892,
    'fluid-ounce': 29.5735,
    'pint': 473.176,
    'quart': 946.353,
    'gallon': 3785.41,
    
    // Count
    'piece': 1,
    'dozen': 12,
    'bunch': 1,
    'head': 1,
    'clove': 1,
    'can': 1,
    'jar': 1,
    'bottle': 1,
    'package': 1,
    'box': 1,
    'bag': 1,
    'container': 1
};

// Store location ordering (for grocery list organization)
const locationOrder = [
    'produce',
    'bakery',
    'deli',
    'meat',
    'canned',
    'pasta',
    'cereal',
    'snacks',
    'baking',
    'spices',
    'condiments',
    'international',
    'health',
    'beverages',
    'dairy',
    'frozen',
    'household'
];

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadFromLocalStorage();
    initializeCalendar();
    setupEventListeners();
    registerServiceWorker();
    setupInstallPrompt();
});

// Register service worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful:', registration);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed:', err);
                });
        });
    }
}

// Setup install prompt
let deferredPrompt;
function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Show install button
        showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        hideInstallButton();
    });
}

// Show install button
function showInstallButton() {
    // Add install button to header if not already present
    if (!document.getElementById('installButton')) {
        const headerActions = document.querySelector('.header-actions');
        const installBtn = document.createElement('button');
        installBtn.id = 'installButton';
        installBtn.className = 'btn btn-primary';
        installBtn.innerHTML = '📱 Install App';
        installBtn.onclick = promptInstall;
        headerActions.insertBefore(installBtn, headerActions.firstChild);
    }
}

// Hide install button
function hideInstallButton() {
    const installBtn = document.getElementById('installButton');
    if (installBtn) {
        installBtn.remove();
    }
}

// Prompt install
async function promptInstall() {
    if (!deferredPrompt) {
        return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
    
    if (outcome === 'accepted') {
        hideInstallButton();
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('mealForm').addEventListener('submit', saveMeal);
}

// Initialize calendar
function initializeCalendar() {
    updateWeekDisplay();
    renderCalendar();
}

// Update week display
function updateWeekDisplay() {
    const weekStart = new Date(currentWeekStart);
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    document.getElementById('currentWeek').textContent = `Week of ${weekStart.toLocaleDateString('en-US', options)}`;
}

// Change week
function changeWeek(direction) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
    updateWeekDisplay();
    renderCalendar();
}

// Update plan duration
function updatePlanDuration() {
    planDuration = parseInt(document.getElementById('planDuration').value);
    renderCalendar();
}

// Render calendar
function renderCalendar() {
    const calendar = document.getElementById('mealCalendar');
    calendar.innerHTML = '';
    
    const daysToShow = planDuration * 7;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < daysToShow; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        const dateKey = currentDate.toISOString().split('T')[0];
        
        dayCard.innerHTML = `
            <div class="day-header">
                <div class="day-name">${dayNames[currentDate.getDay()]}</div>
                <div class="day-date">${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            </div>
            ${renderMealSlots(dateKey)}
        `;
        
        calendar.appendChild(dayCard);
    }
}

// Render meal slots for a day
function renderMealSlots(dateKey) {
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    let slotsHTML = '';
    
    mealTypes.forEach(mealType => {
        const slotKey = `${dateKey}-${mealType}`;
        const meal = mealPlan[slotKey];
        
        slotsHTML += `
            <div class="meal-slot" onclick="handleMealSlotClick('${slotKey}', '${mealType}')">
                <div class="meal-slot-header">${mealType.charAt(0).toUpperCase() + mealType.slice(1)}</div>
                <div class="meal-slot-content">
                    ${meal ? renderMealContent(meal) : '<div class="empty-slot">Click to add meal</div>'}
                </div>
            </div>
        `;
    });
    
    return slotsHTML;
}

// Render meal content
function renderMealContent(meal) {
    let content = `<div class="meal-name">${meal.name}</div>`;
    
    if (meal.tags && meal.tags.length > 0) {
        content += '<div class="meal-tags">';
        meal.tags.forEach(tag => {
            const tagClass = tag.toLowerCase().replace(/\s+/g, '-');
            content += `<span class="tag ${tagClass}">${tag}</span>`;
        });
        content += '</div>';
    }
    
    return content;
}

// Handle meal slot click
function handleMealSlotClick(slotKey, mealType) {
    const meal = mealPlan[slotKey];
    
    if (meal) {
        // Show meal details
        showMealDetails(meal, slotKey);
    } else {
        // Add new meal
        currentEditingSlot = slotKey;
        showMealModal(mealType);
    }
}

// Show meal modal
function showMealModal(mealType = 'breakfast', existingMeal = null, fromRecipe = null) {
    document.getElementById('mealModal').style.display = 'block';
    document.getElementById('mealForm').reset();
    
    if (fromRecipe) {
        // Loading from recipe library
        document.getElementById('mealName').value = fromRecipe.name;
        document.getElementById('mealType').value = mealType;
        document.getElementById('prepTime').value = fromRecipe.prepTime || '';
        document.getElementById('defaultServings').value = fromRecipe.defaultServings || 4;
        document.getElementById('actualServings').value = fromRecipe.defaultServings || 4;
        document.getElementById('needsDefrost').checked = fromRecipe.needsDefrost;
        document.getElementById('canPrepSunday').checked = fromRecipe.canPrepSunday;
        document.getElementById('canPartialPrep').checked = fromRecipe.canPartialPrep;
        document.getElementById('mealTags').value = fromRecipe.tags ? fromRecipe.tags.join(', ') : '';
        document.getElementById('recipeInstructions').value = fromRecipe.instructions || '';
        
        // Add ingredients
        const ingredientsList = document.getElementById('ingredientsList');
        ingredientsList.innerHTML = '<button type="button" class="btn btn-small" onclick="addIngredientRow()">+ Add Ingredient</button>';
        
        if (fromRecipe.ingredients) {
            fromRecipe.ingredients.forEach(ing => {
                addIngredientRow(ing);
            });
        }
    } else if (existingMeal) {
        // Populate form with existing meal data
        document.getElementById('mealName').value = existingMeal.name;
        document.getElementById('mealType').value = existingMeal.type;
        document.getElementById('prepTime').value = existingMeal.prepTime || '';
        document.getElementById('defaultServings').value = existingMeal.defaultServings || 4;
        document.getElementById('actualServings').value = existingMeal.actualServings || 4;
        document.getElementById('needsDefrost').checked = existingMeal.needsDefrost;
        document.getElementById('canPrepSunday').checked = existingMeal.canPrepSunday;
        document.getElementById('canPartialPrep').checked = existingMeal.canPartialPrep;
        document.getElementById('mealTags').value = existingMeal.tags ? existingMeal.tags.join(', ') : '';
        document.getElementById('recipeInstructions').value = existingMeal.instructions || '';
        
        // Add existing ingredients
        const ingredientsList = document.getElementById('ingredientsList');
        ingredientsList.innerHTML = '<button type="button" class="btn btn-small" onclick="addIngredientRow()">+ Add Ingredient</button>';
        
        if (existingMeal.ingredients) {
            existingMeal.ingredients.forEach(ing => {
                addIngredientRow(ing);
            });
        }
    } else {
        document.getElementById('mealType').value = mealType;
        document.getElementById('defaultServings').value = 4;
        document.getElementById('actualServings').value = 4;
        // Clear previous ingredients
        const ingredientsList = document.getElementById('ingredientsList');
        ingredientsList.innerHTML = '<button type="button" class="btn btn-small" onclick="addIngredientRow()">+ Add Ingredient</button>';
    }
    
    checkServingSize();
}

// Close meal modal
function closeMealModal() {
    document.getElementById('mealModal').style.display = 'none';
    currentEditingSlot = null;
}

// Add ingredient row
function addIngredientRow(existingIngredient = null) {
    const ingredientsList = document.getElementById('ingredientsList');
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    
    // Create ingredient select with search
    const ingredientOptions = ingredientDirectory.map(ing => 
        `<option value="${ing.name}">${ing.name}</option>`
    ).join('');
    
    const uniqueId = Date.now() + Math.random();
    
    row.innerHTML = `
        <input type="text" list="ingredients-${uniqueId}" placeholder="Ingredient name" required value="${existingIngredient ? existingIngredient.name : ''}">
        <datalist id="ingredients-${uniqueId}">
            ${ingredientOptions}
        </datalist>
        <input type="number" step="0.01" placeholder="Quantity" required value="${existingIngredient ? existingIngredient.quantity : ''}">
        <select required>
            <option value="">Select unit</option>
            <option value="gram" ${existingIngredient?.unit === 'gram' ? 'selected' : ''}>Gram (g)</option>
            <option value="kilogram" ${existingIngredient?.unit === 'kilogram' ? 'selected' : ''}>Kilogram (kg)</option>
            <option value="milligram" ${existingIngredient?.unit === 'milligram' ? 'selected' : ''}>Milligram (mg)</option>
            <option value="ounce" ${existingIngredient?.unit === 'ounce' ? 'selected' : ''}>Ounce (oz)</option>
            <option value="pound" ${existingIngredient?.unit === 'pound' ? 'selected' : ''}>Pound (lb)</option>
            <option value="milliliter" ${existingIngredient?.unit === 'milliliter' ? 'selected' : ''}>Milliliter (ml)</option>
            <option value="liter" ${existingIngredient?.unit === 'liter' ? 'selected' : ''}>Liter (L)</option>
            <option value="cup" ${existingIngredient?.unit === 'cup' ? 'selected' : ''}>Cup (cup)</option>
            <option value="tablespoon" ${existingIngredient?.unit === 'tablespoon' ? 'selected' : ''}>Tablespoon (tbsp)</option>
            <option value="teaspoon" ${existingIngredient?.unit === 'teaspoon' ? 'selected' : ''}>Teaspoon (tsp)</option>
            <option value="fluid-ounce" ${existingIngredient?.unit === 'fluid-ounce' ? 'selected' : ''}>Fluid Ounce (fl oz)</option>
            <option value="pint" ${existingIngredient?.unit === 'pint' ? 'selected' : ''}>Pint (pt)</option>
            <option value="quart" ${existingIngredient?.unit === 'quart' ? 'selected' : ''}>Quart (qt)</option>
            <option value="gallon" ${existingIngredient?.unit === 'gallon' ? 'selected' : ''}>Gallon (gal)</option>
            <option value="piece" ${existingIngredient?.unit === 'piece' ? 'selected' : ''}>Piece (pc)</option>
            <option value="dozen" ${existingIngredient?.unit === 'dozen' ? 'selected' : ''}>Dozen (doz)</option>
            <option value="bunch" ${existingIngredient?.unit === 'bunch' ? 'selected' : ''}>Bunch (bunch)</option>
            <option value="head" ${existingIngredient?.unit === 'head' ? 'selected' : ''}>Head (head)</option>
            <option value="clove" ${existingIngredient?.unit === 'clove' ? 'selected' : ''}>Clove (clove)</option>
            <option value="can" ${existingIngredient?.unit === 'can' ? 'selected' : ''}>Can (can)</option>
            <option value="jar" ${existingIngredient?.unit === 'jar' ? 'selected' : ''}>Jar (jar)</option>
            <option value="bottle" ${existingIngredient?.unit === 'bottle' ? 'selected' : ''}>Bottle (bottle)</option>
            <option value="package" ${existingIngredient?.unit === 'package' ? 'selected' : ''}>Package (pkg)</option>
            <option value="box" ${existingIngredient?.unit === 'box' ? 'selected' : ''}>Box (box)</option>
            <option value="bag" ${existingIngredient?.unit === 'bag' ? 'selected' : ''}>Bag (bag)</option>
            <option value="container" ${existingIngredient?.unit === 'container' ? 'selected' : ''}>Container (container)</option>
        </select>
        <button type="button" class="remove-ingredient" onclick="this.parentElement.remove()">Remove</button>
    `;
    
    ingredientsList.insertBefore(row, ingredientsList.lastElementChild);
}

// Check serving size
function checkServingSize() {
    const defaultServings = parseInt(document.getElementById('defaultServings').value) || 4;
    const actualServings = parseInt(document.getElementById('actualServings').value) || 4;
    const warning = document.getElementById('servingWarning');
    
    if (defaultServings !== actualServings) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
}

// Save meal
function saveMeal(e) {
    e.preventDefault();
    
    const defaultServings = parseInt(document.getElementById('defaultServings').value) || 4;
    const actualServings = parseInt(document.getElementById('actualServings').value) || 4;
    const servingRatio = actualServings / defaultServings;
    
    const meal = {
        name: document.getElementById('mealName').value,
        type: document.getElementById('mealType').value,
        prepTime: document.getElementById('prepTime').value || null,
        defaultServings: defaultServings,
        actualServings: actualServings,
        needsDefrost: document.getElementById('needsDefrost').checked,
        canPrepSunday: document.getElementById('canPrepSunday').checked,
        canPartialPrep: document.getElementById('canPartialPrep').checked,
        tags: document.getElementById('mealTags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
        instructions: document.getElementById('recipeInstructions').value,
        ingredients: []
    };
    
    // Collect ingredients and adjust quantities based on serving size
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    ingredientRows.forEach(row => {
        const inputs = row.querySelectorAll('input, select');
        if (inputs[0].value && inputs[1].value && inputs[2].value) {
            const baseQuantity = parseFloat(inputs[1].value);
            const adjustedQuantity = baseQuantity * servingRatio;
            
            meal.ingredients.push({
                name: inputs[0].value,
                quantity: adjustedQuantity,
                unit: inputs[2].value,
                baseQuantity: baseQuantity // Store original quantity for recipe
            });
            
            // Add to ingredient directory if not exists
            if (!ingredientDirectory.find(ing => ing.name === inputs[0].value)) {
                ingredientDirectory.push({
                    name: inputs[0].value,
                    category: 'other',
                    defaultUnit: inputs[2].value
                });
            }
        }
    });
    
    // Save to meal plan
    if (currentEditingSlot) {
        mealPlan[currentEditingSlot] = meal;
    }
    
    // Optionally save to recipe library
    if (meal.instructions || meal.ingredients.length > 0) {
        const existingRecipe = recipeLibrary.findIndex(r => r.name === meal.name);
        const recipe = {
            name: meal.name,
            prepTime: meal.prepTime,
            defaultServings: meal.defaultServings,
            needsDefrost: meal.needsDefrost,
            canPrepSunday: meal.canPrepSunday,
            canPartialPrep: meal.canPartialPrep,
            tags: meal.tags,
            instructions: meal.instructions,
            ingredients: meal.ingredients.map(ing => ({
                name: ing.name,
                quantity: ing.baseQuantity || ing.quantity,
                unit: ing.unit
            }))
        };
        
        if (existingRecipe >= 0) {
            recipeLibrary[existingRecipe] = recipe;
        } else {
            recipeLibrary.push(recipe);
        }
    }
    
    saveToLocalStorage();
    renderCalendar();
    closeMealModal();
}

// Show meal details
function showMealDetails(meal, slotKey) {
    const modal = document.getElementById('mealDetailsModal');
    const content = document.getElementById('mealDetailsContent');
    
    let detailsHTML = `
        <div class="meal-details">
            <h2>${meal.name}</h2>
            <div class="meal-meta">
    `;
    
    if (meal.prepTime) {
        detailsHTML += `<p><strong>Prep Time:</strong> ${meal.prepTime} minutes</p>`;
    }
    
    if (meal.defaultServings && meal.actualServings) {
        detailsHTML += `<p><strong>Serving Size:</strong> ${meal.actualServings} servings`;
        if (meal.defaultServings !== meal.actualServings) {
            detailsHTML += ` (recipe default: ${meal.defaultServings} servings)`;
        }
        detailsHTML += `</p>`;
    }
    
    if (meal.needsDefrost) {
        detailsHTML += `<p>⚠️ <strong>Needs defrosting prior to cooking</strong></p>`;
    }
    
    if (meal.canPrepSunday) {
        detailsHTML += `<p>✅ Can be prepped on Sunday</p>`;
    }
    
    if (meal.canPartialPrep) {
        detailsHTML += `<p>✅ Can be partially prepped ahead</p>`;
    }
    
    if (meal.tags && meal.tags.length > 0) {
        detailsHTML += '<div class="meal-tags" style="margin-top: 10px;">';
        meal.tags.forEach(tag => {
            const tagClass = tag.toLowerCase().replace(/\s+/g, '-');
            detailsHTML += `<span class="tag ${tagClass}">${tag}</span>`;
        });
        detailsHTML += '</div>';
    }
    
    detailsHTML += '</div>';
    
    if (meal.instructions) {
        detailsHTML += `
            <div class="meal-instructions">
                <h3>Recipe Instructions</h3>
                <p>${meal.instructions.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }
    
    if (meal.ingredients && meal.ingredients.length > 0) {
        detailsHTML += `
            <div class="meal-ingredients">
                <h3>Ingredients</h3>
                <ul>
        `;
        
        meal.ingredients.forEach(ing => {
            detailsHTML += `<li>${ing.quantity} ${ing.unit} ${ing.name}</li>`;
        });
        
        detailsHTML += `
                </ul>
            </div>
        `;
    }
    
    detailsHTML += `
        <div class="meal-actions">
            <button class="btn btn-primary" onclick="editMeal('${slotKey}')">Edit Meal</button>
            <button class="btn btn-delete" onclick="deleteMeal('${slotKey}')">Delete Meal</button>
        </div>
    `;
    
    detailsHTML += '</div>';
    
    content.innerHTML = detailsHTML;
    modal.style.display = 'block';
}

// Edit meal
function editMeal(slotKey) {
    const meal = mealPlan[slotKey];
    currentEditingSlot = slotKey;
    closeMealDetailsModal();
    showMealModal(meal.type, meal);
}

// Delete meal
function deleteMeal(slotKey) {
    if (confirm('Are you sure you want to delete this meal?')) {
        delete mealPlan[slotKey];
        saveToLocalStorage();
        renderCalendar();
        closeMealDetailsModal();
    }
}

// Close meal details modal
function closeMealDetailsModal() {
    document.getElementById('mealDetailsModal').style.display = 'none';
}

// Show ingredient modal
function showIngredientModal() {
    document.getElementById('ingredientModal').style.display = 'block';
    displayIngredientDirectory();
}

// Close ingredient modal
function closeIngredientModal() {
    document.getElementById('ingredientModal').style.display = 'none';
}

// Display ingredient directory
function displayIngredientDirectory() {
    const directory = document.getElementById('ingredientDirectory');
    directory.innerHTML = '';
    
    const sortedIngredients = [...ingredientDirectory].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedIngredients.forEach((ingredient, index) => {
        const item = document.createElement('div');
        item.className = 'ingredient-item';
        
        let details = `Category: ${ingredient.category} | Default Unit: ${ingredient.defaultUnit}`;
        if (ingredient.location) {
            details += ` | Location: ${ingredient.location}`;
        }
        if (ingredient.stores && ingredient.stores.length > 0) {
            details += ` | Available at: ${ingredient.stores.join(', ')}`;
        }
        if (ingredient.isFrozen) {
            details += ' | ❄️ Frozen';
        }
        if (ingredient.isRefrigerated) {
            details += ' | 🧊 Refrigerated';
        }
        
        item.innerHTML = `
            <div class="ingredient-info">
                <div class="ingredient-name">${ingredient.name}</div>
                <div class="ingredient-details">${details}</div>
            </div>
            <div class="ingredient-actions">
                <button class="btn-edit" onclick="editIngredient(${index})">Edit</button>
                <button class="btn-delete" onclick="deleteIngredient(${index})">Delete</button>
            </div>
        `;
        directory.appendChild(item);
    });
}

// Edit ingredient
function editIngredient(index) {
    const ingredient = ingredientDirectory[index];
    document.getElementById('newIngredientName').value = ingredient.name;
    document.getElementById('newIngredientCategory').value = ingredient.category;
    document.getElementById('newIngredientUnit').value = ingredient.defaultUnit;
    document.getElementById('newIngredientLocation').value = ingredient.location || '';
    document.getElementById('newIngredientStores').value = ingredient.stores ? ingredient.stores.join(', ') : '';
    document.getElementById('newIngredientFrozen').checked = ingredient.isFrozen || false;
    document.getElementById('newIngredientRefrigerated').checked = ingredient.isRefrigerated || false;
    
    // Remove the old ingredient
    ingredientDirectory.splice(index, 1);
    
    showAddIngredientForm();
}

// Delete ingredient
function deleteIngredient(index) {
    if (confirm('Are you sure you want to delete this ingredient?')) {
        ingredientDirectory.splice(index, 1);
        saveToLocalStorage();
        displayIngredientDirectory();
    }
}

// Search ingredients
function searchIngredients() {
    const searchTerm = document.getElementById('ingredientSearch').value.toLowerCase();
    const items = document.querySelectorAll('.ingredient-item');
    
    items.forEach(item => {
        const name = item.querySelector('.ingredient-name').textContent.toLowerCase();
        item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Show add ingredient form
function showAddIngredientForm() {
    document.getElementById('addIngredientForm').style.display = 'block';
}

// Hide add ingredient form
function hideAddIngredientForm() {
    document.getElementById('addIngredientForm').style.display = 'none';
    document.getElementById('newIngredientName').value = '';
    document.getElementById('newIngredientLocation').value = '';
    document.getElementById('newIngredientStores').value = '';
    document.getElementById('newIngredientFrozen').checked = false;
    document.getElementById('newIngredientRefrigerated').checked = false;
}

// Add new ingredient
function addNewIngredient(e) {
    e.preventDefault();
    
    const ingredient = {
        name: document.getElementById('newIngredientName').value,
        category: document.getElementById('newIngredientCategory').value,
        defaultUnit: document.getElementById('newIngredientUnit').value,
        location: document.getElementById('newIngredientLocation').value,
        stores: document.getElementById('newIngredientStores').value.split(',').map(s => s.trim()).filter(s => s),
        isFrozen: document.getElementById('newIngredientFrozen').checked,
        isRefrigerated: document.getElementById('newIngredientRefrigerated').checked
    };
    
    if (!ingredientDirectory.find(ing => ing.name === ingredient.name)) {
        ingredientDirectory.push(ingredient);
        saveToLocalStorage();
        displayIngredientDirectory();
        hideAddIngredientForm();
    } else {
        alert('This ingredient already exists!');
    }
}

// Generate grocery list
function generateGroceryList() {
    const groceryList = {};
    const daysToInclude = planDuration * 7;
    
    // Collect all ingredients from meal plan
    for (let i = 0; i < daysToInclude; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const dateKey = currentDate.toISOString().split('T')[0];
        
        ['breakfast', 'lunch', 'dinner', 'snack'].forEach(mealType => {
            const slotKey = `${dateKey}-${mealType}`;
            const meal = mealPlan[slotKey];
            
            if (meal && meal.ingredients) {
                meal.ingredients.forEach(ing => {
                    const key = ing.name.toLowerCase();
                    
                    if (!groceryList[key]) {
                        const ingredientInfo = getIngredientInfo(ing.name);
                        groceryList[key] = {
                            name: ing.name,
                            quantities: [],
                            category: ingredientInfo.category,
                            location: ingredientInfo.location,
                            stores: ingredientInfo.stores,
                            isFrozen: ingredientInfo.isFrozen,
                            isRefrigerated: ingredientInfo.isRefrigerated
                        };
                    }
                    
                    groceryList[key].quantities.push({
                        quantity: ing.quantity,
                        unit: ing.unit
                    });
                });
            }
        });
    }
    
    // Aggregate quantities
    const aggregatedList = {};
    Object.values(groceryList).forEach(item => {
        aggregatedList[item.name] = {
            name: item.name,
            category: item.category,
            location: item.location,
            stores: item.stores,
            isFrozen: item.isFrozen,
            isRefrigerated: item.isRefrigerated,
            totalQuantity: aggregateQuantities(item.quantities)
        };
    });
    
    displayGroceryList(aggregatedList);
}

// Get ingredient info
function getIngredientInfo(ingredientName) {
    const ingredient = ingredientDirectory.find(ing => ing.name.toLowerCase() === ingredientName.toLowerCase());
    return ingredient || {
        name: ingredientName,
        category: 'other',
        location: '',
        stores: [],
        isFrozen: false,
        isRefrigerated: false
    };
}

// Aggregate quantities with unit conversion
function aggregateQuantities(quantities) {
    if (quantities.length === 0) return '0';
    
    // Group by measurement type
    const groups = {
        weight: ['gram', 'kilogram', 'milligram', 'ounce', 'pound'],
        volume: ['milliliter', 'liter', 'cup', 'tablespoon', 'teaspoon', 'fluid-ounce', 'pint', 'quart', 'gallon'],
        count: ['piece', 'dozen', 'bunch', 'head', 'clove', 'can', 'jar', 'bottle', 'package', 'box', 'bag', 'container']
    };
    
    // Find the measurement type
    let measurementType = 'count';
    const firstUnit = quantities[0].unit;
    for (const [type, units] of Object.entries(groups)) {
        if (units.includes(firstUnit)) {
            measurementType = type;
            break;
        }
    }
    
    // Convert all to base unit and sum
    let total = 0;
    let mixedUnits = false;
    
    quantities.forEach(q => {
        if (groups[measurementType].includes(q.unit)) {
            total += q.quantity * (unitConversions[q.unit] || 1);
        } else {
            mixedUnits = true;
        }
    });
    
    if (mixedUnits) {
        // If mixed units, just list them all
        return quantities.map(q => `${q.quantity} ${q.unit}`).join(' + ');
    }
    
    // Convert back to appropriate unit
    if (measurementType === 'weight') {
        if (total >= 1000) {
            return `${(total / 1000).toFixed(2)} kg`;
        } else {
            return `${total.toFixed(0)} g`;
        }
    } else if (measurementType === 'volume') {
        if (total >= 1000) {
            return `${(total / 1000).toFixed(2)} L`;
        } else if (total >= 250) {
            return `${(total / 236.588).toFixed(2)} cups`;
        } else {
            return `${total.toFixed(0)} ml`;
        }
    } else {
        // For count items, handle special cases
        if (firstUnit === 'dozen' && total >= 12) {
            const dozens = Math.floor(total / 12);
            const remainder = total % 12;
            if (remainder === 0) {
                return `${dozens} dozen`;
            } else {
                return `${dozens} dozen + ${remainder} pieces`;
            }
        }
        return `${total} ${firstUnit}${total !== 1 ? 's' : ''}`;
    }
}

// Display grocery list
function displayGroceryList(groceryList) {
    const modal = document.getElementById('groceryListModal');
    const content = document.getElementById('groceryListContent');
    
    // Group by store
    const storeGroups = {};
    const noStoreItems = [];
    
    Object.values(groceryList).forEach(item => {
        if (item.stores && item.stores.length > 0) {
            item.stores.forEach(store => {
                if (!storeGroups[store]) {
                    storeGroups[store] = [];
                }
                storeGroups[store].push(item);
            });
        } else {
            noStoreItems.push(item);
        }
    });
    
    // Find the best store (most items)
    let bestStore = '';
    let maxItems = 0;
    Object.entries(storeGroups).forEach(([store, items]) => {
        if (items.length > maxItems) {
            maxItems = items.length;
            bestStore = store;
        }
    });
    
    let listHTML = '';
    
    // Display best store first
    if (bestStore) {
        listHTML += renderStoreSection(bestStore, storeGroups[bestStore], true);
        
        // Display other stores
        Object.entries(storeGroups).forEach(([store, items]) => {
            if (store !== bestStore) {
                listHTML += renderStoreSection(store, items, false);
            }
        });
    }
    
    // Display items without store info
    if (noStoreItems.length > 0) {
        listHTML += renderStoreSection('Other Items', noStoreItems, false);
    }
    
    content.innerHTML = listHTML;
    modal.style.display = 'block';
}

// Render store section
function renderStoreSection(storeName, items, isBestStore) {
    // Group items by location
    const locationGroups = {};
    
    items.forEach(item => {
        const location = item.location || 'other';
        if (!locationGroups[location]) {
            locationGroups[location] = [];
        }
        locationGroups[location].push(item);
    });
    
    // Sort locations according to store layout
    const sortedLocations = Object.keys(locationGroups).sort((a, b) => {
        const aIndex = locationOrder.indexOf(a);
        const bIndex = locationOrder.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    let html = `
        <div class="store-section">
            <div class="store-header">
                <h3 class="store-name">${storeName} ${isBestStore ? '⭐ (Best Option)' : ''}</h3>
                <span class="store-item-count">${items.length} items</span>
            </div>
    `;
    
    sortedLocations.forEach(location => {
        const locationItems = locationGroups[location];
        const locationName = location.charAt(0).toUpperCase() + location.slice(1);
        
        html += `
            <div class="location-group">
                <div class="location-header">${locationName}</div>
        `;
        
        locationItems.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            html += `
                <div class="grocery-item-print">
                    <div class="item-details">
                        <div class="item-name-print">${item.name}</div>
                        <div class="item-quantity-print">${item.totalQuantity}</div>
                    </div>
                    <div class="cost-field">
                        <span>$</span>
                        <div class="cost-input"></div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    html += '</div>';
    
    return html;
}

// Close grocery list modal
function closeGroceryListModal() {
    document.getElementById('groceryListModal').style.display = 'none';
}

// Download grocery list
function downloadGroceryList() {
    const content = document.getElementById('groceryListContent');
    let textContent = 'GROCERY LIST\n';
    textContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    // Extract text content from HTML
    const storeSections = content.querySelectorAll('.store-section');
    storeSections.forEach(section => {
        const storeName = section.querySelector('.store-name').textContent;
        textContent += `\n${storeName}\n${'='.repeat(storeName.length)}\n\n`;
        
        const locationGroups = section.querySelectorAll('.location-group');
        locationGroups.forEach(group => {
            const locationName = group.querySelector('.location-header').textContent;
            textContent += `${locationName}:\n`;
            
            const items = group.querySelectorAll('.grocery-item-print');
            items.forEach(item => {
                const name = item.querySelector('.item-name-print').textContent;
                const quantity = item.querySelector('.item-quantity-print').textContent;
                textContent += `  □ ${name} - ${quantity}\n`;
            });
            textContent += '\n';
        });
    });
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-list-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Print grocery list
function printGroceryList() {
    window.print();
}

// Save meal plan
function saveMealPlan() {
    const planData = {
        mealPlan: mealPlan,
        ingredientDirectory: ingredientDirectory,
        weekStart: currentWeekStart.toISOString(),
        planDuration: planDuration
    };
    
    const blob = new Blob([JSON.stringify(planData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meal-plan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Load meal plan
function loadMealPlan() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const planData = JSON.parse(event.target.result);
                mealPlan = planData.mealPlan || {};
                ingredientDirectory = planData.ingredientDirectory || [];
                currentWeekStart = new Date(planData.weekStart || new Date());
                planDuration = planData.planDuration || 1;
                
                document.getElementById('planDuration').value = planDuration;
                
                saveToLocalStorage();
                updateWeekDisplay();
                renderCalendar();
                
                alert('Meal plan loaded successfully!');
            } catch (error) {
                alert('Error loading meal plan. Please check the file format.');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Print meal plan
function printMealPlan() {
    window.print();
}

// Save to local storage
function saveToLocalStorage() {
    localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
    localStorage.setItem('ingredientDirectory', JSON.stringify(ingredientDirectory));
    localStorage.setItem('recipeLibrary', JSON.stringify(recipeLibrary));
    localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
    localStorage.setItem('planDuration', planDuration);
}

// Load from local storage
function loadFromLocalStorage() {
    const savedMealPlan = localStorage.getItem('mealPlan');
    const savedIngredients = localStorage.getItem('ingredientDirectory');
    const savedRecipes = localStorage.getItem('recipeLibrary');
    const savedWeekStart = localStorage.getItem('currentWeekStart');
    const savedPlanDuration = localStorage.getItem('planDuration');
    
    if (savedMealPlan) {
        mealPlan = JSON.parse(savedMealPlan);
    }
    
    if (savedIngredients) {
        ingredientDirectory = JSON.parse(savedIngredients);
    } else {
        // Initialize with some default ingredients
        ingredientDirectory = [
            { name: 'Chicken Breast', category: 'meat', defaultUnit: 'pound', location: 'meat', stores: ['Walmart', 'King Soopers'] },
            { name: 'Rice', category: 'pantry', defaultUnit: 'cup', location: 'pasta', stores: ['Walmart', 'King Soopers'] },
            { name: 'Broccoli', category: 'produce', defaultUnit: 'bunch', location: 'produce', stores: ['Walmart', 'Whole Foods'] },
            { name: 'Milk', category: 'dairy', defaultUnit: 'cup', location: 'dairy', stores: ['Walmart', 'King Soopers'], isRefrigerated: true },
            { name: 'Eggs', category: 'dairy', defaultUnit: 'piece', location: 'dairy', stores: ['Walmart', 'King Soopers'], isRefrigerated: true },
            { name: 'Bread', category: 'bakery', defaultUnit: 'piece', location: 'bakery', stores: ['Walmart', 'King Soopers'] },
            { name: 'Olive Oil', category: 'pantry', defaultUnit: 'tablespoon', location: 'condiments', stores: ['Walmart', 'Whole Foods'] },
            { name: 'Salt', category: 'pantry', defaultUnit: 'teaspoon', location: 'spices', stores: ['Walmart', 'King Soopers'] },
            { name: 'Black Pepper', category: 'pantry', defaultUnit: 'teaspoon', location: 'spices', stores: ['Walmart', 'King Soopers'] },
            { name: 'Garlic', category: 'produce', defaultUnit: 'clove', location: 'produce', stores: ['Walmart', 'Whole Foods'] },
            { name: 'Frozen Peas', category: 'frozen', defaultUnit: 'cup', location: 'frozen', stores: ['Walmart', 'King Soopers'], isFrozen: true },
            { name: 'Ground Beef', category: 'meat', defaultUnit: 'pound', location: 'meat', stores: ['Walmart', 'King Soopers'], isRefrigerated: true },
            { name: 'Pasta', category: 'pantry', defaultUnit: 'package', location: 'pasta', stores: ['Walmart', 'King Soopers'] },
            { name: 'Tomato Sauce', category: 'pantry', defaultUnit: 'can', location: 'canned', stores: ['Walmart', 'King Soopers'] },
            { name: 'Cheese', category: 'dairy', defaultUnit: 'cup', location: 'dairy', stores: ['Walmart', 'King Soopers'], isRefrigerated: true },
            { name: 'Yogurt', category: 'dairy', defaultUnit: 'container', location: 'dairy', stores: ['Walmart', 'Whole Foods'], isRefrigerated: true },
            { name: 'Bananas', category: 'produce', defaultUnit: 'piece', location: 'produce', stores: ['Walmart', 'King Soopers'] },
            { name: 'Apples', category: 'produce', defaultUnit: 'piece', location: 'produce', stores: ['Walmart', 'Whole Foods'] },
            { name: 'Spinach', category: 'produce', defaultUnit: 'bunch', location: 'produce', stores: ['Walmart', 'Whole Foods'] },
            { name: 'Chicken Stock', category: 'pantry', defaultUnit: 'cup', location: 'canned', stores: ['Walmart', 'King Soopers'] }
        ];
    }
    
    if (savedWeekStart) {
        currentWeekStart = new Date(savedWeekStart);
    }
    
    if (savedRecipes) {
        recipeLibrary = JSON.parse(savedRecipes);
    }
    
    if (savedPlanDuration) {
        planDuration = parseInt(savedPlanDuration);
        document.getElementById('planDuration').value = planDuration;
    }
}

// Show recipe library modal
function showRecipeLibraryModal() {
    document.getElementById('recipeLibraryModal').style.display = 'block';
    displayRecipeLibrary();
}

// Close recipe library modal
function closeRecipeLibraryModal() {
    document.getElementById('recipeLibraryModal').style.display = 'none';
}

// Display recipe library
function displayRecipeLibrary() {
    const content = document.getElementById('recipeLibraryContent');
    content.innerHTML = '';
    
    if (recipeLibrary.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No recipes saved yet. Add meals with instructions or ingredients to build your recipe library!</p>';
        return;
    }
    
    const sortedRecipes = [...recipeLibrary].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedRecipes.forEach((recipe, index) => {
        const recipeCard = document.createElement('div');
        recipeCard.className = 'recipe-card';
        recipeCard.style.cssText = `
            background-color: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            border: 2px solid var(--border-color);
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        recipeCard.onmouseover = function() {
            this.style.borderColor = 'var(--primary-color)';
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        };
        
        recipeCard.onmouseout = function() {
            this.style.borderColor = 'var(--border-color)';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        };
        
        let recipeHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <h3 style="color: var(--primary-color); margin-bottom: 10px;">${recipe.name}</h3>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
        `;
        
        if (recipe.prepTime) {
            recipeHTML += `<p>⏱️ Prep Time: ${recipe.prepTime} minutes</p>`;
        }
        
        if (recipe.defaultServings) {
            recipeHTML += `<p>🍽️ Default Servings: ${recipe.defaultServings}</p>`;
        }
        
        if (recipe.tags && recipe.tags.length > 0) {
            recipeHTML += '<div class="meal-tags" style="margin-top: 10px;">';
            recipe.tags.forEach(tag => {
                const tagClass = tag.toLowerCase().replace(/\s+/g, '-');
                recipeHTML += `<span class="tag ${tagClass}">${tag}</span>`;
            });
            recipeHTML += '</div>';
        }
        
        recipeHTML += `
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-small btn-primary" onclick="useRecipeForMeal(${index}, event)">Use Recipe</button>
                    <button class="btn btn-small btn-delete" onclick="deleteRecipe(${index}, event)">Delete</button>
                </div>
            </div>
        `;
        
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            recipeHTML += `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                    <strong>Ingredients:</strong>
                    <ul style="margin-top: 5px; margin-left: 20px;">
            `;
            recipe.ingredients.forEach(ing => {
                recipeHTML += `<li>${ing.quantity} ${ing.unit} ${ing.name}</li>`;
            });
            recipeHTML += '</ul></div>';
        }
        
        recipeCard.innerHTML = recipeHTML;
        recipeCard.onclick = function(e) {
            if (!e.target.classList.contains('btn')) {
                showRecipeDetails(recipe);
            }
        };
        
        content.appendChild(recipeCard);
    });
}

// Search recipes
function searchRecipes() {
    const searchTerm = document.getElementById('recipeSearch').value.toLowerCase();
    const recipeCards = document.querySelectorAll('.recipe-card');
    
    recipeCards.forEach(card => {
        const recipeName = card.querySelector('h3').textContent.toLowerCase();
        const ingredients = card.querySelectorAll('li');
        let hasIngredient = false;
        
        ingredients.forEach(ing => {
            if (ing.textContent.toLowerCase().includes(searchTerm)) {
                hasIngredient = true;
            }
        });
        
        card.style.display = (recipeName.includes(searchTerm) || hasIngredient) ? 'block' : 'none';
    });
}

// Show recipe details
function showRecipeDetails(recipe) {
    const modal = document.getElementById('mealDetailsModal');
    const content = document.getElementById('mealDetailsContent');
    
    let detailsHTML = `
        <div class="meal-details">
            <h2>${recipe.name}</h2>
            <div class="meal-meta">
    `;
    
    if (recipe.prepTime) {
        detailsHTML += `<p><strong>Prep Time:</strong> ${recipe.prepTime} minutes</p>`;
    }
    
    if (recipe.defaultServings) {
        detailsHTML += `<p><strong>Default Servings:</strong> ${recipe.defaultServings}</p>`;
    }
    
    if (recipe.needsDefrost) {
        detailsHTML += `<p>⚠️ <strong>Needs defrosting prior to cooking</strong></p>`;
    }
    
    if (recipe.canPrepSunday) {
        detailsHTML += `<p>✅ Can be prepped on Sunday</p>`;
    }
    
    if (recipe.canPartialPrep) {
        detailsHTML += `<p>✅ Can be partially prepped ahead</p>`;
    }
    
    if (recipe.tags && recipe.tags.length > 0) {
        detailsHTML += '<div class="meal-tags" style="margin-top: 10px;">';
        recipe.tags.forEach(tag => {
            const tagClass = tag.toLowerCase().replace(/\s+/g, '-');
            detailsHTML += `<span class="tag ${tagClass}">${tag}</span>`;
        });
        detailsHTML += '</div>';
    }
    
    detailsHTML += '</div>';
    
    if (recipe.instructions) {
        detailsHTML += `
            <div class="meal-instructions">
                <h3>Recipe Instructions</h3>
                <p>${recipe.instructions.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }
    
    if (recipe.ingredients && recipe.ingredients.length > 0) {
        detailsHTML += `
            <div class="meal-ingredients">
                <h3>Ingredients (for ${recipe.defaultServings} servings)</h3>
                <ul>
        `;
        
        recipe.ingredients.forEach(ing => {
            detailsHTML += `<li>${ing.quantity} ${ing.unit} ${ing.name}</li>`;
        });
        
        detailsHTML += `
                </ul>
            </div>
        `;
    }
    
    detailsHTML += '</div>';
    
    content.innerHTML = detailsHTML;
    modal.style.display = 'block';
}

// Use recipe for meal
function useRecipeForMeal(recipeIndex, event) {
    event.stopPropagation();
    const recipe = recipeLibrary[recipeIndex];
    
    // Ask which meal type
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const mealType = prompt('Which meal type? (breakfast, lunch, dinner, snack)', 'dinner');
    
    if (mealType && mealTypes.includes(mealType.toLowerCase())) {
        closeRecipeLibraryModal();
        showMealModal(mealType.toLowerCase(), null, recipe);
    }
}

// Delete recipe
function deleteRecipe(recipeIndex, event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this recipe from your library?')) {
        recipeLibrary.splice(recipeIndex, 1);
        saveToLocalStorage();
        displayRecipeLibrary();
    }
}

// Show add recipe form (save current recipe being edited)
function showAddRecipeForm() {
    const mealName = document.getElementById('mealName').value;
    if (!mealName) {
        alert('Please enter a meal name before saving to recipe library.');
        return;
    }
    
    // Save the current form data as a recipe
    const defaultServings = parseInt(document.getElementById('defaultServings').value) || 4;
    
    const recipe = {
        name: mealName,
        prepTime: document.getElementById('prepTime').value || null,
        defaultServings: defaultServings,
        needsDefrost: document.getElementById('needsDefrost').checked,
        canPrepSunday: document.getElementById('canPrepSunday').checked,
        canPartialPrep: document.getElementById('canPartialPrep').checked,
        tags: document.getElementById('mealTags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
        instructions: document.getElementById('recipeInstructions').value,
        ingredients: []
    };
    
    // Collect ingredients
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    ingredientRows.forEach(row => {
        const inputs = row.querySelectorAll('input, select');
        if (inputs[0].value && inputs[1].value && inputs[2].value) {
            recipe.ingredients.push({
                name: inputs[0].value,
                quantity: parseFloat(inputs[1].value),
                unit: inputs[2].value
            });
        }
    });
    
    // Check if recipe already exists
    const existingIndex = recipeLibrary.findIndex(r => r.name === recipe.name);
    if (existingIndex >= 0) {
        if (confirm(`Recipe "${recipe.name}" already exists. Do you want to update it?`)) {
            recipeLibrary[existingIndex] = recipe;
        } else {
            return;
        }
    } else {
        recipeLibrary.push(recipe);
    }
    
    saveToLocalStorage();
    alert(`Recipe "${recipe.name}" has been saved to your library!`);
    closeRecipeLibraryModal();
    showRecipeLibraryModal();
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
