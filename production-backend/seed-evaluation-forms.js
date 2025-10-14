const { Client } = require('pg');
const { execSync } = require('child_process');
const crypto = require('crypto');

async function seedEvaluationForms() {
  console.log('🌱 Seeding Evaluation Forms...\n');
  
  const dbUrl = execSync(
    'aws secretsmanager get-secret-value --secret-id sales-scorecard-db-url --region eu-north-1 --query SecretString --output text'
  ).toString().trim();
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('✅ Connected to database\n');
  
  try {
    // Clear existing data
    console.log('🗑️  Clearing existing behavior data...');
    await client.query('DELETE FROM behavior_items');
    await client.query('DELETE FROM behavior_categories');
    console.log('✅ Cleared\n');
    
    // =======================
    // FORM 1: Sales Lead → Salesperson Evaluation
    // =======================
    console.log('📝 Creating Form 1: Sales Lead → Salesperson Evaluation\n');
    
    const slToSpCategories = [
      {
        id: crypto.randomUUID(),
        name: 'Discovery',
        description: 'Customer needs discovery and questioning skills',
        order: 1,
        weight: 0.25,
        roleTarget: 'SALESPERSON', // This form is for evaluating salespeople
        items: [
          { name: 'Asks open-ended questions', description: 'Uses open-ended questions to understand customer needs', order: 1 },
          { name: 'Uncovers customer pain points', description: 'Identifies and explores customer challenges', order: 2 },
          { name: 'Identifies decision makers', description: 'Discovers who makes purchasing decisions', order: 3 }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'Solution Positioning',
        description: 'Product knowledge and value proposition',
        order: 2,
        weight: 0.25,
        roleTarget: 'SALESPERSON',
        items: [
          { name: 'Tailors solution to customer context', description: 'Customizes pitch to customer situation', order: 1 },
          { name: 'Articulates clear value proposition', description: 'Clearly explains benefits and value', order: 2 },
          { name: 'Demonstrates product knowledge', description: 'Shows deep understanding of product features', order: 3 }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'Closing & Next Steps',
        description: 'Moving deals forward and securing commitments',
        order: 3,
        weight: 0.25,
        roleTarget: 'SALESPERSON',
        items: [
          { name: 'Makes clear asks', description: 'Directly asks for the business or next step', order: 1 },
          { name: 'Identifies next steps', description: 'Defines specific actions to move forward', order: 2 },
          { name: 'Sets mutual commitments', description: 'Establishes commitments from both sides', order: 3 }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'Professionalism',
        description: 'Professional conduct and communication',
        order: 4,
        weight: 0.25,
        roleTarget: 'SALESPERSON',
        items: [
          { name: 'Arrives prepared', description: 'Comes to meetings with research and materials ready', order: 1 },
          { name: 'Manages time effectively', description: 'Respects time and stays on agenda', order: 2 },
          { name: 'Maintains professional demeanor', description: 'Acts professionally and builds trust', order: 3 }
        ]
      }
    ];
    
    // =======================
    // FORM 2: Regional Manager → Sales Lead Coaching Evaluation
    // =======================
    console.log('📝 Creating Form 2: Regional Manager → Sales Lead Coaching Evaluation\n');
    
    const rmToSlCategories = [
      {
        id: crypto.randomUUID(),
        name: 'Coaching Skills',
        description: 'Field coaching and development abilities',
        order: 1,
        weight: 1.0,
        roleTarget: 'SALES_LEAD', // This form is for evaluating sales leads
        items: [
          { name: 'Exploratory Questioning Skills', description: 'Asks exploratory/diagnostic questions before offering feedback', order: 1 },
          { name: 'Behavioral Feedback Focus', description: 'Provides feedback on behavior, not just results', order: 2 },
          { name: 'Collaborative Goal Setting', description: 'Involves rep in setting next steps for improvement', order: 3 },
          { name: 'Activity-Specific Goal Linking', description: 'Goal links to a specific sales activity (e.g., opening visits, upselling)', order: 4 },
          { name: 'Specific Behavior Identification', description: 'Manager identifies a specific behavior that needs improvement', order: 5 },
          { name: 'Customer Impact Discussion', description: 'Discusses what was the behavior effect over the customer', order: 6 }
        ]
      }
    ];
    
    // Combine all categories
    const allCategories = [...slToSpCategories, ...rmToSlCategories];
    
    // Insert categories and items
    for (const category of allCategories) {
      console.log(`  📂 Creating category: ${category.name} (for ${category.roleTarget})`);
      
      await client.query(
        `INSERT INTO behavior_categories (id, name, "order", weight, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [category.id, `${category.name} (${category.roleTarget})`, category.order, category.weight]
      );
      
      for (const item of category.items) {
        const itemId = crypto.randomUUID();
        console.log(`    ✓ ${item.name}`);
        
        await client.query(
          `INSERT INTO behavior_items (id, "categoryId", name, "order", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [itemId, category.id, item.name, item.order, true]
        );
      }
    }
    
    console.log('\n✅ Evaluation forms seeded successfully!\n');
    
    // Verify
    const countResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM behavior_categories) as categories,
        (SELECT COUNT(*) FROM behavior_items) as items
    `);
    
    console.log('📊 Summary:');
    console.log(`  Categories: ${countResult.rows[0].categories}`);
    console.log(`  Items: ${countResult.rows[0].items}`);
    console.log('\n🎯 Forms created:');
    console.log('  1. Sales Lead → Salesperson (4 categories, 12 items)');
    console.log('  2. Regional Manager → Sales Lead (1 category, 6 items)');
    
  } catch (error) {
    console.error('❌ Error seeding forms:', error);
  } finally {
    await client.end();
  }
}

seedEvaluationForms();
