-- Create table for storing category and subcategory images
create table if not exists category_images (
    id uuid default gen_random_uuid() primary key,
    category_name text not null,
    subcategory_name text, -- nullable for category-level images
    image_url text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Ensure unique combinations
    unique(category_name, subcategory_name)
);

-- Enable RLS
alter table category_images enable row level security;

-- Policy for superusers and agents to manage images
create policy "Superusers and agents can manage category images" on category_images
for all
using (true)
with check (true);

-- Policy for agency users to view images
create policy "Agency users can view category images" on category_images
for select
using (true);

-- Create updated_at trigger
create or replace function update_category_images_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_category_images_updated_at
    before update on category_images
    for each row
    execute function update_category_images_updated_at();