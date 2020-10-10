import * as functions from "firebase-functions";
import * as express from "express";
import * as admin from "firebase-admin";
import * as cors from "cors";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const app = express();

function errorMiddleware(
  err: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.json({
    error: err.toString(),
    status: 500,
  });
}

app.use(errorMiddleware);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

async function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.header("Authorization");
  if (token == null) return res.sendStatus(403);
  const idToken = token.split(" ");
  if (idToken[1] == null) return res.sendStatus(403);

  try {
    await admin.auth().verifyIdToken(idToken[1]);
    next();
    return;
  } catch (e) {
    return res.sendStatus(403);
  }
}

app.use(authMiddleware);

const router = express.Router();

router.get('/users', (req, res) => {
    res.json({
        message: 'hello users. this is dummy endpoint!!',
        status: 200,
    })
})

router.get("/users/:uid/todos", async (req, res) => {
  const snap = await admin
    .firestore()
    .collection(`users/${req.params.uid}/todos`)
    .orderBy('update_at', 'desc')
    .get();
  res.json(
    snap.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        update_at: data.update_at.toDate().toISOString(),
        create_at: data.create_at.toDate().toISOString(),
      }
    })
  );
});

router.post('/users/:uid/todos', async (req, res) => {
    const collectionRef = admin.firestore().collection(`users/${req.params.uid}/todos`);
    const data = req.body;
    const result = await collectionRef.add({
        ...data,
        update_at: admin.firestore.Timestamp.now(),
        create_at: admin.firestore.Timestamp.now(),
    })
    res.json((await result.get()).data());
})

router.get("/users/:uid/todos/:todoId", async (req, res) => {
  const doc = await admin
    .firestore()
    .doc(`users/${req.params.uid}/todos/${req.params.todoId}`)
    .get();
  const data = doc.data();
  if (data == null) {
    res.sendStatus(404);
    return;
  }
  res.json({
    ...data,
    id: doc.id,
    update_at: data.update_at.toDate().toISOString(),
    create_at: data.create_at.toDate().toISOString(),
  });
});

router.patch("/users/:uid/todos/:todoId", async (req, res) => {
  const data = req.body;
  const ref = admin
  .firestore()
  .doc(`users/${req.params.uid}/todos/${req.params.todoId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    res.sendStatus(404)
    return;
  }
  await ref.set({
      ...data,
      update_at: admin.firestore.Timestamp.now(),
    }, {merge: true});
  res.sendStatus(200);
});

router.delete("/users/:uid/todos/:todoId", async (req, res) => {
  const ref = admin
  .firestore()
  .doc(`users/${req.params.uid}/todos/${req.params.todoId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    res.sendStatus(404);
    return;
  }
  await ref
    .delete();
  res.sendStatus(200);
});

app.use(router);

exports.tyotos = functions.https.onRequest(app);