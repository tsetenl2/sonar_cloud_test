import { SidebarExtensionSDK } from "contentful-ui-extensions-sdk";

interface SidebarProps {
  sdk: SidebarExtensionSDK;
}

export const refreshClone = async (
  cloneEntry: any,
  masterEntry: any,
  locale: string,
  props: SidebarProps
) => {
  const clonedDefaultEntries: any[] = [];
  const masterDefaultEntries: any[] = [];
  const contentTypes: any[] = [];

  const getContentType = async (contentTypeId: string) => {
    let find = contentTypes.find(
      (contentType) => contentType.sys.id === contentTypeId
    );
    if (find) {
      return find;
    }

    let contentType = await props.sdk.space.getContentType(contentTypeId);
    contentTypes.push(contentType);

    return contentType;
  };

  const findRichTextFieldEntries = async (
    masterRichTextContent: any,
    cloneRichTextContent: any
  ) => {
    for (let idx in masterRichTextContent) {
      const obj1 = masterRichTextContent[idx];
      if (idx < cloneRichTextContent.length) {
        const obj2 = cloneRichTextContent[idx];
        if (
          [
            "embedded-entry-block",
            "embedded-entry-inline",
            "entry-hyperlink",
          ].includes(obj1.nodeType)
        ) {
          if (
            masterDefaultEntries.find(
              (e) => e.sys.id === obj1.data.target.sys.id
            )
          ) {
            return;
          }
          let masterEntry: any = await props.sdk.space.getEntry(
            obj1.data.target.sys.id
          );
          let cloneEntry: any = await props.sdk.space.getEntry(
            obj2.data.target.sys.id
          );
          masterDefaultEntries.push(masterEntry);
          clonedDefaultEntries.push(cloneEntry);
        } else if (obj1.content && obj2.content) {
          await findRichTextFieldEntries(obj1.content, obj2.content);
        }
      }
    }
  };

  const findEntries = async (entryId: string, cloneId: string) => {
    if (masterDefaultEntries.find((e) => e.sys.id === entryId)) {
      return;
    } else if (clonedDefaultEntries.find((e) => e.sys.id === cloneId)) {
      return;
    }

    let masterEntry: any = await props.sdk.space.getEntry(entryId);
    let cloneEntry: any = await props.sdk.space.getEntry(cloneId);

    let ct: any = await getContentType(masterEntry.sys.contentType.sys.id);
    let refFields: any[] = [];
    let richTextFields: any[] = [];

    for (let field of ct.fields) {
      if (field.type === "RichText") {
        richTextFields.push(field);
      } else if (field.type === "Link" && field.linkType === "Entry") {
        refFields.push(field);
      } else if (
        field.type === "Array" &&
        field.items.type === "Link" &&
        field.items.linkType === "Entry"
      ) {
        refFields.push(field);
      }
    }

    for (let field of refFields) {
      if (masterEntry.fields[field.id]) {
        let availableLocale = props.sdk.locales.default;
        if (masterEntry.fields[field.id][locale]) {
          availableLocale = locale;
        }
        if (field.type === "Link") {
          if (
            cloneEntry.fields[field.id] &&
            cloneEntry.fields[field.id][availableLocale]
          ) {
            await findEntries(
              masterEntry.fields[field.id][availableLocale].sys.id,
              cloneEntry.fields[field.id][availableLocale].sys.id
            );
          }
        } else {
          for (let idx in masterEntry.fields[field.id][
            availableLocale
          ] as any) {
            const link1 = masterEntry.fields[field.id][availableLocale][idx];
            if (
              cloneEntry.fields[field.id] &&
              cloneEntry.fields[field.id][availableLocale] &&
              idx < cloneEntry.fields[field.id][availableLocale].length
            ) {
              const link2 = cloneEntry.fields[field.id][availableLocale][idx];
              await findEntries(link1.sys.id, link2.sys.id);
            }
          }
        }
      }
    }

    for (let field of richTextFields) {
      if (masterEntry.fields[field.id] && field.type === "RichText") {
        let availableLocale = props.sdk.locales.default;
        if (masterEntry.fields[field.id][locale]) {
          availableLocale = locale;
        }
        if (masterEntry.fields[field.id][availableLocale]) {
          await findRichTextFieldEntries(
            masterEntry.fields[field.id][availableLocale].content,
            cloneEntry.fields[field.id][availableLocale].content
          );
        }
      }
    }

    masterDefaultEntries.push(masterEntry);
    clonedDefaultEntries.push(cloneEntry);
  };

  const updateLocalizedEntries = async (locale: string) => {
    for (let idx in clonedDefaultEntries) {
      let clonedDefaultEntry = clonedDefaultEntries[idx];
      let masterDefaultEntry = masterDefaultEntries[idx];
      if (clonedDefaultEntry && masterDefaultEntry) {
        let ct: any = await getContentType(
          masterDefaultEntry.sys.contentType.sys.id
        );
        for (let field of ct.fields) {
          // Prevent resetting links and defaultId
          if (field.id !== "defaultId" && field.type !== "Link") {
            if (!clonedDefaultEntry.fields[field.id]) {
              clonedDefaultEntry.fields[field.id] = {};
            }
            if (field.localized) {
              if (masterDefaultEntry.fields[field.id]) {
                clonedDefaultEntry.fields[field.id][locale] =
                  masterDefaultEntry.fields[field.id][locale];
              }
              for (let otherLocale of Object.keys(
                clonedDefaultEntry.fields[field.id]
              )) {
                if (otherLocale !== locale) {
                  delete clonedDefaultEntry.fields[field.id][otherLocale];
                }
              }
            } else {
              clonedDefaultEntry.fields[field.id] =
                masterDefaultEntry.fields[field.id];
            }
          }
        }
        await props.sdk.space.updateEntry(clonedDefaultEntry);
      }
    }
  };

  await findEntries(masterEntry.sys.id, cloneEntry.sys.id);

  await updateLocalizedEntries(locale);
};
