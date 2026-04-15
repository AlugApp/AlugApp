import { supabase } from "../src/lib/supabaseClient";

async function checkColumns() {
  const { data, error } = await supabase.from("item").select("*").limit(1);
  if (error) {
    console.error("Error fetching item:", error);
  } else if (data && data.length > 0) {
    console.log("Columns in 'item' table:", Object.keys(data[0]));
  } else {
    console.log("No items found in 'item' table to check columns.");
  }
}

checkColumns();
