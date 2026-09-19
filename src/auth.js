// src/auth.js — NextAuth sin MySQL directo: todo vía API interna (lib/api).
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { createUser, getUserByEmail, login, patchUser } from "@/lib/api";

function MezclarProveedor(actual, nuevo) {
  const lista = String(actual || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!lista.includes(nuevo)) lista.push(nuevo);
  return lista.join(",");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    Credentials({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const user = await login(credentials.email, credentials.password);
          if (!user?.id) return null;
          return {
            id: String(user.id),
            name: user.nombre || user.name || credentials.email,
            email: user.email || credentials.email,
            image: user.imagen_url || user.image || null,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // OAuth vía API: vincula o crea sin tocar MySQL.
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          const existente = await getUserByEmail(user.email);
          if (!existente) {
            try {
              await createUser({
                nombre: user.name || user.email,
                email: user.email,
                password: `oauth-${account.provider}-${Date.now()}`,
                proveedor: account.provider,
              });
            } catch (errorCreacion) {
              // 409 = el usuario ya existe (carrera o 429 previo que sí creó):
              // dejar pasar y que la sesión lo resuelva.
              if (Number(errorCreacion?.status) !== 409) throw errorCreacion;
            }
          } else if (!String(existente.proveedor || "").split(",").includes(account.provider)) {
            try {
              await patchUser(existente.id, {
                proveedor: MezclarProveedor(existente.proveedor, account.provider),
                bienvenida_vista: 0,
              });
            } catch {
              await patchUser(existente.id, {
                proveedor: MezclarProveedor(existente.proveedor, account.provider),
              });
            }
          }
        } catch (error) {
          // 401/403 aquí = API_SECRET_KEY rechazado por servxn o ausente en
          // Vercel: fallar cerrado con diagnóstico (ver logs del servidor).
          console.error(
            "Error al guardar usuario OAuth vía API:",
            error?.status ? `status=${error.status}` : "",
            error?.message || error
          );
          // 429/5xx = backend saturado (transitorio): lanzar en vez de
          // devolver false para no convertirlo en AccessDenied permanente;
          // NextAuth muestra error y el usuario puede reintentar.
          if ([429, 502, 503, 504].includes(Number(error?.status))) throw error;
          return false;
        }
      }
      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        try {
          const u = await getUserByEmail(session.user.email);
          if (u) {
            session.user.id = u.id;
            if (u.nombre) session.user.name = u.nombre;
            session.user.image = u.imagen_url || session.user.image || null;
            session.user.genero = u.genero || null;
            session.user.bienvenidaVista = u.bienvenida_vista ?? 1;
          }
        } catch (error) {
          console.error("Error al resolver la sesión vía API:", error?.message || error);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
