// apps/web/app/test-db/page.tsx
import { createClient } from '../../utils/supabase/server';
import { revalidatePath } from 'next/cache';

export default async function TestDbPage() {
  // 1. Server Action to capture form data and insert into Supabase
  async function addTestDoctor(formData: FormData) {
    'use server';
    
    const supabase = await createClient();
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const specialization = formData.get('specialization') as string;

    // Insert the row into your cloud database
    const { data, error } = await supabase
      .from('doctors')
      .insert([{ full_name: fullName, email, specialization }])
      .select();

    if (error) {
      console.error('Database Error:', error.message);
    } else {
      console.log('Successfully created doctor record:', data);
    }

    // Tells Next.js to clear its cache and update the UI with the new entry
    revalidatePath('/test-db');
  }

  // 2. Fetch the existing doctors to display them live on the page
  const supabase = await createClient();
  const { data: doctors } = await supabase.from('doctors').select('*');

  return (
    <div className="p-12 bg-zinc-950 text-white min-h-screen space-y-8">
      <div className="max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
        <h2 className="text-xl font-bold mb-4 text-emerald-400">Test Doctor Insertion</h2>
        
        <form action={addTestDoctor} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-zinc-400">Full Name</label>
            <input name="fullName" type="text" required className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-emerald-500" placeholder="Dr. Lasantha Silva" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-400">Email Address</label>
            <input name="email" type="email" required className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-emerald-500" placeholder="lasantha@medcenter.com" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-400">Specialization</label>
            <input name="specialization" type="text" required className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-emerald-500" placeholder="Pediatrician" />
          </div>
          <button type="submit" className="w-full bg-emerald-600 py-2 rounded font-bold hover:bg-emerald-700 transition">
            Create Doctor Record
          </button>
        </form>
      </div>

      {/* Live Data Verification Section */}
      <div className="max-w-2xl p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
        <h3 className="text-lg font-bold mb-4 text-zinc-400">Active Database Records</h3>
        <div className="space-y-2">
          {doctors && doctors.length > 0 ? (
            doctors.map((doc) => (
              <div key={doc.id} className="p-3 bg-zinc-800/50 rounded border border-zinc-700/50 flex justify-between font-mono text-sm">
                <span className="text-emerald-400 font-bold">{doc.full_name} ({doc.specialization})</span>
                <span className="text-zinc-400">{doc.email}</span>
              </div>
            ))
          ) : (
            <p className="text-zinc-500 text-sm">No records found. Submit the form above to add one.</p>
          )}
        </div>
      </div>
    </div>
  );
}