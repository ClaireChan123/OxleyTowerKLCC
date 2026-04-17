import { 
  collection, 
  doc, 
  getDocs, 
  onSnapshot, 
  query, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export const uploadImage = (file: File, path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    console.log(`Starting upload to: ${storageRef.fullPath}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Set a 5-minute timeout (300,000 ms) for large files
    const timeout = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error('Upload to storage timed out (5 minutes). Your internet connection might be too slow or the file might be exceptionally large. We recommend using images under 5MB.'));
    }, 300000);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        console.log(`Upload progress: ${progress}%`);
      }, 
      (error) => {
        clearTimeout(timeout);
        console.error('Storage Upload Error Detail:', error);
        
        switch (error.code) {
          case 'storage/unauthorized':
            reject(new Error('Firebase Storage Permission Denied. Please ensure your "Storage Rules" are set to "allow read, write: if true;" (or authenticated) in the Firebase Console.'));
            break;
          case 'storage/canceled':
            reject(new Error('The upload was canceled. This often happens if the connection is lost or the 5-minute timeout was reached.'));
            break;
          case 'storage/retry-limit-exceeded':
            reject(new Error('Upload failed after multiple retries. Please check your internet connection.'));
            break;
          default:
            reject(new Error(`Storage error (${error.code}): ${error.message}`));
        }
      }, 
      () => {
        clearTimeout(timeout);
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          console.log('File available at', downloadURL);
          resolve(downloadURL);
        });
      }
    );
  });
};

export const updateContent = async (id: string, data: any) => {
  try {
    await setDoc(doc(db, 'content', id), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `content/${id}`);
  }
};

export const updateLayout = async (id: string, data: any) => {
  try {
    await setDoc(doc(db, 'layouts', id), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `layouts/${id}`);
  }
};

export const deleteLayout = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'layouts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `layouts/${id}`);
  }
};

export const updateGalleryImage = async (id: string, data: any) => {
  try {
    await setDoc(doc(db, 'gallery', id), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `gallery/${id}`);
  }
};

export const deleteGalleryImage = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'gallery', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `gallery/${id}`);
  }
};
