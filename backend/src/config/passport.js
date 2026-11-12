import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import { env } from './env.js';

export const googleEnabled = Boolean(env.google.clientId && env.google.clientSecret);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.google.clientId,
        clientSecret: env.google.clientSecret,
        callbackURL: `${env.apiUrl}/api/auth/google/callback`,
        passReqToCallback: true,
      },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(null, false);

          let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
          if (!user) {
            // The role chosen before the redirect travels in the OAuth "state" parameter.
            const role = req.query.state === 'entrepreneur' ? 'entrepreneur' : 'investor';
            user = await User.create({
              firstName: profile.name?.givenName || profile.displayName || 'Dinarius',
              lastName: profile.name?.familyName || 'User',
              email,
              googleId: profile.id,
              role,
              avatarUrl: profile.photos?.[0]?.value ?? '',
            });
          } else if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user.isActive ? user : false);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
}

export { passport };
