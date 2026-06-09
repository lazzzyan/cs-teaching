-- CS Teaching Platform - Supabase Schema

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  thumbnail_url TEXT,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_category ON resources(category);
CREATE INDEX idx_resources_tags ON resources USING GIN(tags);
CREATE INDEX idx_resources_user_id ON resources(user_id);
CREATE INDEX idx_resources_created_at ON resources(created_at DESC);

ALTER TABLE resources ADD COLUMN search_vector tsvector;
CREATE INDEX idx_resources_search ON resources USING GIN(search_vector);

CREATE OR REPLACE FUNCTION resources_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '') || ' ' || COALESCE(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resources_search BEFORE INSERT OR UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION resources_search_update();

CREATE TABLE resource_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT CHECK (vote_type IN ('like', 'dislike')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);
CREATE INDEX idx_votes_resource ON resource_votes(resource_id);
CREATE INDEX idx_votes_user ON resource_votes(user_id);

CREATE OR REPLACE FUNCTION update_vote_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'like' THEN
      UPDATE resources SET likes_count = likes_count + 1 WHERE id = NEW.resource_id;
    ELSE
      UPDATE resources SET dislikes_count = dislikes_count + 1 WHERE id = NEW.resource_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'like' THEN
      UPDATE resources SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.resource_id;
    ELSE
      UPDATE resources SET dislikes_count = GREATEST(dislikes_count - 1, 0) WHERE id = OLD.resource_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type = 'like' AND NEW.vote_type = 'dislike' THEN
      UPDATE resources SET likes_count = GREATEST(likes_count - 1, 0), dislikes_count = dislikes_count + 1 WHERE id = NEW.resource_id;
    ELSIF OLD.vote_type = 'dislike' AND NEW.vote_type = 'like' THEN
      UPDATE resources SET dislikes_count = GREATEST(dislikes_count - 1, 0), likes_count = likes_count + 1 WHERE id = NEW.resource_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_vote_counts AFTER INSERT OR UPDATE OR DELETE ON resource_votes FOR EACH ROW EXECUTE FUNCTION update_vote_counts();

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_resource ON comments(resource_id);
CREATE INDEX idx_comments_user ON comments(user_id);

CREATE OR REPLACE FUNCTION update_comment_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE resources SET comments_count = comments_count + 1 WHERE id = NEW.resource_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE resources SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.resource_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_comment_counts AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION update_comment_counts();

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_participants ON chat_messages(sender_id, receiver_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by all" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users delete own profile" ON profiles FOR DELETE USING (auth.uid() = id);
CREATE POLICY "Admins delete any profile" ON profiles FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Resources viewable by all" ON resources FOR SELECT USING (true);
CREATE POLICY "Users insert resources" ON resources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own resources" ON resources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own resources" ON resources FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete any resource" ON resources FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Votes viewable by all" ON resource_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON resource_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users change own vote" ON resource_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users remove own vote" ON resource_votes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Comments viewable by all" ON comments FOR SELECT USING (true);
CREATE POLICY "Users insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete any comment" ON comments FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Users view own friendships" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users send friend request" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own friendships" ON friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users delete own friendships" ON friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users view own messages" ON chat_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users send messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users update own messages" ON chat_messages FOR UPDATE USING (auth.uid() = sender_id);

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
